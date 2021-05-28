import { schema, SchemaObject, normalize as normalize$, denormalize, NormalizedSchema } from 'normalizr';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { atomFamily, useAtomValue, useUpdateAtom } from 'jotai/utils';
import merge from 'deepmerge';

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

  const entityAtoms = atomFamily((name: EntityKey) => atom(initialEntityRecord?.[name] || {} as EntityRecord<Entities>[EntityKey]));

  const entitySelector = atom<EntityRecord<Entities>, EntityRecord<Entities>>(
    get => Object.keys(entityModels).reduce((result, key) => ({
      ...result,
      [key]: get(entityAtoms(key as EntityKey))
    }), {} as EntityRecord<Entities>),
    (get, set, newValue) => {
      for (const [key, value] of Object.entries(newValue)) {
        const entityAtom = entityAtoms(key as EntityKey);
        set(entityAtom, merge(get(entityAtom), value));
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
    useEntitys
  };
}