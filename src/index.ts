import { schema, SchemaObject, normalize as normalize$, denormalize, NormalizedSchema } from 'normalizr';
import { atom, useAtom, Provider } from 'jotai';
import { useMemo, FC, createElement, useEffect } from 'react';
import createStore from 'zustand/vanilla';
import produce, { Draft } from 'immer';
import { atomWithStore } from 'jotai/zustand';
import { useAtomValue } from 'jotai/utils';
import deepMerge from 'deepmerge';
import deepEqual from 'deep-equal';

const overwriteMerge = (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray;

function merge<V>(a: V, b: V): V {
  return deepMerge(a, b, { arrayMerge: overwriteMerge });
}
export interface EntitySchemaWithDefinition<T, D> extends schema.Entity<T> {
  $definition: D;
}

export function createEntityModel<T>(name: string) {
  return function<
    D extends Record<string, unknown>,
    O extends schema.EntityOptions<T>,
  >(definition?: D | ((entity: schema.Entity<T>) => D), options?: O) {
    const model = new schema.Entity<T>(name, undefined, options);
    if (definition) {
      model.define((typeof definition === 'function' ? definition(model) : definition) as SchemaObject<unknown>);
    }
    return model as EntitySchemaWithDefinition<T, D>;
  }
}

type GetModelFromEntity<E> = E extends schema.Entity<infer T> ? T : never;

export type EntityRecord<E extends Record<string, EntitySchemaWithDefinition<unknown, unknown>>> = {
  [key in keyof E]: Partial<Record<PropertyKey, Omit<GetModelFromEntity<E[key]>, keyof E[key]['$definition']> & {
    [key2 in keyof E[key]['$definition']]: PropertyKey;
  }>>;
}

const LIBRARY_SCOPE = '$$react-entity-normalize-station';

export function configureNormalizeEntityStation<
  Entities extends Record<string, EntitySchemaWithDefinition<unknown, unknown>>,
  EntityKey extends keyof Entities
>(entityModelCreator: Entities | ((createModel: typeof createEntityModel) => Entities)) {
  const entityModels = typeof entityModelCreator === 'function' ? entityModelCreator(createEntityModel) : entityModelCreator;

  const entityStore = createStore(() => Object.keys(entityModels).reduce((result, key) => {
    return {
      ...result,
      [key]: {}
    }
  }, {} as EntityRecord<Entities>));
  const entityAtoms = atomWithStore(entityStore);
  entityAtoms.scope = LIBRARY_SCOPE;

  function normalize<
    K extends EntityKey,
    T extends GetModelFromEntity<Entities[K]>,
    D extends T | T[]
  >(name: K, data: D) {
    if (!entityModels[name]) {
      throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
    }
    const model = Array.isArray(data) ? [entityModels[name]] : entityModels[name];
    const { result, entities } = normalize$<
      T,
      EntityRecord<Entities>,
      D extends unknown[] ? PropertyKey[] : PropertyKey
    >(data, model);
    const entityState = entityStore.getState();
    const newEntityState = merge(entityState, entities);
    if (!deepEqual(entityState, newEntityState)) {
      entityStore.setState(newEntityState);
    }
    return result;
  }

  function produceEntity<
    K extends EntityKey,
    R extends EntityRecord<Entities>[K]
  >(name: K, callback: R | ((state: Draft<R>) => void | undefined | Draft<R>)) {
    const entities = entityStore.getState();
    const targetEntities = entities[name] as R;
    const resultEntities = typeof callback === 'function'
      ? produce<R>(targetEntities, callback)
      : merge(targetEntities, callback);
    if (!deepEqual(resultEntities, targetEntities)) {
      entityStore.setState({
        ...entities,
        [name]: resultEntities
      });
    }
  }

  function createEntityDenormalizeSelector<
    K extends EntityKey,
    D extends PropertyKey | PropertyKey[],
    M extends GetModelFromEntity<Entities[K]>,
    R extends D extends unknown[] ? M[] : (M | undefined)
  >(name: K, data: D) {
    const $denormalizeAtom = atom<R, R>(
      (get) => {
        const entityRecord = get(entityAtoms);
        if (!entityModels[name]) {
          throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
        }
        const result = denormalize(data, Array.isArray(data) ? [entityModels[name]] : entityModels[name], entityRecord);
        return Array.isArray(result) ? result.filter(Boolean) : result;
      },
      (_get, _set, update) => {
        if (update) {
          normalize(name, update!);
        }
      }
    );
    $denormalizeAtom.scope = LIBRARY_SCOPE;
    return $denormalizeAtom;
  }

  function useDenormalize<
    K extends EntityKey,
    D extends PropertyKey | PropertyKey[],
  >(name: K, data: D) {
    const denormalizeAtom = useMemo(() => createEntityDenormalizeSelector(name, data), [name, data]);
    return useAtom(denormalizeAtom);
  }

  function useNormalizeEntity<K extends EntityKey, M extends GetModelFromEntity<Entities[K]>, D extends M | M[]>(name: K, data: D) {
    const normalizeResult = useMemo(() => normalize(name, data), [name, data]);
    return useDenormalize(name, normalizeResult);
  }

  function useEntitys () {
    return useAtomValue(entityAtoms);
  }

  const NormalizeEntityProvider: FC<{
    initialEntityRecord?: EntityRecord<Entities>
  }> = ({ initialEntityRecord, ...props }) => {
    useEffect(() => {
      if (initialEntityRecord) {
        entityStore.setState(initialEntityRecord);
      }
    }, []);
    return createElement(Provider, {
      ...props,
      scope: LIBRARY_SCOPE
    });
  };

  return {
    normalize,
    useDenormalize,
    useNormalizeEntity,
    useEntitys,
    produceEntity,
    NormalizeEntityProvider
  };
}