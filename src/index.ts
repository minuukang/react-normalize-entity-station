import { schema, SchemaObject, normalize as normalize$, denormalize, NormalizedSchema } from 'normalizr';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import createStore from 'zustand/vanilla';
import produce, { Draft } from 'immer';
import { atomWithStore } from 'jotai/zustand';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
import merge from 'deepmerge';
import equal from 'deep-equal';

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

export function configureNormalizeEntityStation<
  Entities extends Record<string, EntitySchemaWithDefinition<unknown, unknown>>,
  EntityKey extends keyof Entities
>(entityModelCreator: Entities | ((createModel: typeof createEntityModel) => Entities), initialEntityRecord?: EntityRecord<Entities>) {
  const entityModels = typeof entityModelCreator === 'function' ? entityModelCreator(createEntityModel) : entityModelCreator;

  function normalize<
    K extends EntityKey,
    T extends GetModelFromEntity<Entities[K]>,
    D extends T | T[]
  >(name: K, data: D): NormalizedSchema<EntityRecord<Entities>, D extends unknown[] ? PropertyKey[] : PropertyKey> {
    if (!entityModels[name]) {
      throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
    }
    return normalize$(data, Array.isArray(data) ? [entityModels[name]] : entityModels[name]);
  }

  const entityStore = createStore(() => Object.keys(entityModels).reduce((result, key) => {
    return {
      ...result,
      [key]: {}
    }
  }, {} as EntityRecord<Entities>));
  const entityAtoms = atomWithStore(entityStore);

  function produceEntity<
    K extends EntityKey,
    R extends EntityRecord<Entities>[K]
  >(name: K, callback: R | ((state: Draft<R>) => never)) {
    const entities = entityStore.getState();
    const targetEntities = entities[name];
    const resultEntities = typeof callback === 'function'
      ? produce(targetEntities, callback)
      : merge(targetEntities, callback);
    if (!equal(resultEntities, targetEntities)) {
      entityStore.setState({
        ...entities,
        [name]: resultEntities
      });
    }
  }

  const entitySelector = atom<EntityRecord<Entities>, EntityRecord<Entities>>(
    get => get(entityAtoms),
    (_get, _set, newValue) => {
      for (const [key, entities] of Object.entries(newValue)) {
        produceEntity(key as EntityKey, entities);
        // const entityAtom = entityAtoms(key as EntityKey);
        // for (const [id, value] of Object.entries(entities)) {
        //   const entityItems = get(entityAtom);
        //   const entityValue = entityItems[id];
        //   if (!entityValue || !equal(entityValue, value)) {
        //     set(entityAtom, {
        //       ...entityItems,
        //       [id]: entityValue ? merge(entityValue, value as EntitySchemaWithDefinition<unknown, unknown>) : value
        //     });
        //   }
        // }
      }
    }
  );

  function createEntityDenormalizeSelector<
    K extends EntityKey,
    D extends PropertyKey | PropertyKey[],
    M extends GetModelFromEntity<Entities[K]>,
    R extends D extends unknown[] ? M[] : (M | undefined)
  >(name: K, data: D) {
    return atom<R, R>(
      (get) => {
        const entityRecord = get(entitySelector);
        if (!entityModels[name]) {
          throw new Error(`Entity model [${name}] is not defined! Check wrong letter or configureNormalizeEntityStation()`);
        }
        const result = denormalize(data, Array.isArray(data) ? [entityModels[name]] : entityModels[name], entityRecord);
        return Array.isArray(result) ? result.filter(Boolean) : result;
      },
      (_get, set, update) => {
        if (update) {
          const { entities } = normalize(name, update!);
          set(entitySelector, entities);
        }
      }
    );
  }

  function useDenormalize<
    K extends EntityKey,
    D extends PropertyKey | PropertyKey[],
  >(name: K, data: D) {
    const denormalizeAtom = useMemo(() => createEntityDenormalizeSelector(name, data), [name, data]);
    return useAtom(denormalizeAtom);
  }

  function useNormalizeEntity<K extends EntityKey, M extends GetModelFromEntity<Entities[K]>, D extends M | M[]>(name: K, data: D) {
    const setEntityRecord = useUpdateAtom(entitySelector);
    const normalizeResult = useMemo(() => normalize(name, data), [name, data]);

    useEffect(() => {
      setEntityRecord(normalizeResult.entities);
    }, [normalizeResult]);

    return useDenormalize(name, normalizeResult.result);
  }

  function useNormalizeHandler () {
    const setEntityRecord = useUpdateAtom(entitySelector);
    return useCallback(<K extends EntityKey, M extends GetModelFromEntity<Entities[K]>, D extends M | M[]>(name: K, data: D) => {
      const { result, entities } = normalize(name, data);
      setEntityRecord(entities);
      return result;
    }, [setEntityRecord]);
  }

  function useEntitys () {
    return useAtomValue(entitySelector);
  }

  return {
    useDenormalize,
    useNormalizeEntity,
    useNormalizeHandler,
    useEntitys,
    produceEntity
  };
}