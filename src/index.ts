import { schema, SchemaValue, SchemaObject, normalize as normalize$, denormalize as denormalize$ } from 'normalizr';
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

export type PartialDataAndArray<T> = (T | undefined) | T[];
export type ToDataOrArray<S, T> = S extends unknown[] ? T[] : T;
export type ToPartialDataOrArray<S, T> = S extends unknown[] ? T[] : (T | undefined);

export interface EntitySchemaWithDefinition<T, D, _O> extends schema.Entity<T> {
  $definition: D;
}

export type GetIdType<E> = E extends Array<infer A> ? GetIdType<A> :
  E extends EntitySchemaWithDefinition<infer T, infer _, infer O>
    ? undefined extends O ? ('id' extends keyof T ? T['id'] : PropertyKey) : (
      O extends EntityOptionsWithIdType<T> ? (
        undefined extends O['idAttribute'] ? ('id' extends keyof T ? T['id'] : PropertyKey) : (
          NonNullable<O['idAttribute']> extends keyof T ? T[NonNullable<O['idAttribute']>] : string
        )
      ) : PropertyKey
    ) : PropertyKey;

export interface EntityOptionsWithIdType<T> extends Omit<schema.EntityOptions<T>, 'idAttribute'> {
  idAttribute?: keyof T | ((value: T, parent: unknown, key: string) => string);
}

export function createEntityModel<T>(name: string) {
  return <
    D extends Record<string, SchemaValue<T>>,
    O extends EntityOptionsWithIdType<T> | undefined = undefined,
  >(definition?: D | ((entity: EntitySchemaWithDefinition<T, unknown, O>) => D), options?: O) => {
    const model = new schema.Entity<T>(name, undefined, options as schema.EntityOptions<T>) as EntitySchemaWithDefinition<T, D, O>;
    if (definition) {
      model.define((typeof definition === 'function' ? definition(model) : definition) as SchemaObject<unknown>);
    }
    return model;
  }
}

export type GetModelFromEntity<E> = E extends EntitySchemaWithDefinition<infer T, infer _, infer _> ? T : never;

export type EntityRecord<E extends Record<string, EntitySchemaWithDefinition<unknown, unknown, unknown>>> = {
  [key in keyof E]: Partial<Record<
    PropertyKey,
    Omit<
      GetModelFromEntity<E[key]>,
      keyof E[key]['$definition']
    > & {
      [key2 in keyof E[key]['$definition']]:
        key2 extends keyof GetModelFromEntity<E[key]>
          ? ToDataOrArray<E[key]['$definition'][key2], GetIdType<E[key]['$definition'][key2]>> | (
            undefined extends GetModelFromEntity<E[key]>[key2] ? undefined : never
          ) : never
    }
  >>;
};

export type EntityModel<E extends Record<string, EntitySchemaWithDefinition<unknown, unknown, unknown>>> = {
  [K in keyof E]: E[K] extends EntitySchemaWithDefinition<infer M, unknown, unknown>
    ? M
    : never;
};

const LIBRARY_SCOPE = '$$react-entity-normalize-station';

export function configureNormalizeEntityStation<
  Entities extends Record<string, EntitySchemaWithDefinition<unknown, unknown, unknown>>,
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

  function getModel(name: EntityKey, data: unknown | unknown[]) {
    if (!entityModels[name]) {
      throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
    }
    return Array.isArray(data) ? [entityModels[name]] : entityModels[name];
  }

  function normalize<
    K extends EntityKey,
    T extends GetModelFromEntity<Entities[K]>,
    D extends T | T[]
  >(name: K, data: D) {
    if (!entityModels[name]) {
      throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
    }
    const model = getModel(name, data);
    const { result, entities } = normalize$<
      T,
      EntityRecord<Entities>,
      ToDataOrArray<D, GetIdType<Entities[K]>>
    >(data, model);
    const entityState = entityStore.getState();
    const newEntityState = merge(entityState, entities);
    if (!deepEqual(entityState, newEntityState)) {
      entityStore.setState(newEntityState);
    }
    return result;
  }

  function denormalize<
    K extends EntityKey,
    D extends PartialDataAndArray<GetIdType<Entities[K]>>,
    M extends GetModelFromEntity<Entities[K]>,
    R extends ToPartialDataOrArray<D, M>
  >(name: K, data: D, entities?: EntityRecord<Entities>): R {
    const model = getModel(name, data);
    const result = denormalize$(data, model, entities || entityStore.getState());
    return Array.isArray(result) ? result.filter(Boolean) : result;
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
    D extends PartialDataAndArray<GetIdType<Entities[K]>>,
    M extends GetModelFromEntity<Entities[K]>,
    R extends ToPartialDataOrArray<D, M>
  >(name: K, data: D) {
    const $denormalizeAtom = atom<R, R>(
      (get) => {
        return data && denormalize(name, data!, get(entityAtoms)) as R;
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
    D extends PartialDataAndArray<GetIdType<Entities[K]>>
  >(name: K, data: D) {
    const denormalizeAtom = useMemo(() => createEntityDenormalizeSelector(name, data), [name, data]);
    return useAtom(denormalizeAtom);
  }

  function useNormalizeEntity<
    K extends EntityKey,
    M extends GetModelFromEntity<Entities[K]>,
    D extends PartialDataAndArray<M>
  >(name: K, data: D) {
    const normalizeResult = useMemo(() => data && normalize(name, data!), [name, data]);
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
    entityStore,
    normalize,
    denormalize,
    useDenormalize,
    useNormalizeEntity,
    useEntitys,
    produceEntity,
    NormalizeEntityProvider
  };
}