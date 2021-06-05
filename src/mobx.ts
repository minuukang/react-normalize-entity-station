import { useEffect } from 'react';
import { set, get, toJS, runInAction } from 'mobx';
import { useLocalObservable } from 'mobx-react-lite';

import {
  configureNormalizeEntityStation as configureNormalizeEntityStation$,
  createEntityModel,
  EntitySchemaWithDefinition,
  EntityModel,
  GetModelFromEntity
} from './index';

export * from './index';

type MobxEntityObservableKeys<E, S> = {
  [K in keyof S]: NonNullable<S[K]> extends E[keyof E] | E[keyof E][]
    ? K
    : never;
}[keyof S];

type GetEntityKey<E, V> = {
  [K in keyof E]: NonNullable<V> extends E[K] | E[K][] ? K : never;
}[keyof E];

type MobxEntitySubscriber<E, S> = {
  [K in MobxEntityObservableKeys<E, S>]: GetEntityKey<E, S[K]>;
};

const OBSERVER_PREFIX = '$$_ENTITY_STATION_MOBX_';

export function configureNormalizeEntityStation<
  Entities extends Record<string, EntitySchemaWithDefinition<unknown, unknown, unknown>>,
  EntityKey extends keyof Entities,
  EntitiesModel extends EntityModel<Entities>
>(entityModelCreator: Entities | ((createModel: typeof createEntityModel) => Entities)) {
  const station = configureNormalizeEntityStation$<Entities, EntityKey>(entityModelCreator);
  const { useEntitys, denormalize, normalize } = station;

  function useEntityObservable<V extends Record<string, unknown>>(initailizer: () => V, subscribers: MobxEntitySubscriber<EntitiesModel, V>) {
    const entities = useEntitys();
    const store = useLocalObservable<V>(() => {
      const storeObject = Object.assign(initailizer(), {
        _updateEntity: 0
      });
      for (const [observerKey, modelKey] of Object.entries(subscribers) as [keyof V, EntityKey][]) {
        const normalizeObserverKey = `${OBSERVER_PREFIX}${observerKey}`;
        Object.assign(storeObject, {
          [normalizeObserverKey]: Array.isArray(storeObject[observerKey]) ? [] : undefined
        });
        Object.defineProperty(storeObject, observerKey, {
          get() {
            get(store, '_updateEntity'); // Trigger for update entitiy
            return denormalize(modelKey, toJS(get(store, normalizeObserverKey)));
          },
          set(newValue?: GetModelFromEntity<Entities[keyof Entities]>) {
            const jsValue = toJS(newValue);
            if (jsValue) {
              set(store, {
                [normalizeObserverKey]: normalize(modelKey, jsValue)
              });
            }
          }
        });
      }
      return storeObject;
    });

    useEffect(() => {
      runInAction(() => {
        set(store, {
          _updateEntity: Math.random()
        });
      });
    }, [entities]);

    return store;
  }

  return {
    ...station,
    useEntityObservable
  };
}