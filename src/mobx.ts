import { useEffect, useRef } from 'react';
import { set, get, toJS, runInAction } from 'mobx';
import { useLocalObservable } from 'mobx-react-lite';

import {
  configureNormalizeEntityStation as configureNormalizeEntityStation$,
  createEntityModel,
  EntitySchemaWithDefinition,
  EntityModel,
  GetModelFromEntity,
  PartialDataAndArray,
  GetIdType,
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
  EntitiesModel extends EntityModel<Entities>,
>(entityModelCreator: Entities | ((createModel: typeof createEntityModel) => Entities)) {
  const station = configureNormalizeEntityStation$<Entities, EntityKey>(entityModelCreator);
  const { denormalize, normalize, subscribe } = station;

  function useEntityObservable<V>(initailizer: () => V, subscribers: MobxEntitySubscriber<EntitiesModel, V>) {
    const unsubscribersRef = useRef<{ unsubscriber?: ReturnType<typeof subscribe> }[]>([]);
    const store = useLocalObservable<V>(() => {
      const storeObject = initailizer();
      for (const [observerKey, modelKey] of Object.entries(subscribers) as [keyof V, EntityKey][]) {
        // Setting observer key
        const normalizeObserverKey = `${OBSERVER_PREFIX}${observerKey}`;
        const normalizeUpdateKey = `${OBSERVER_PREFIX}${observerKey}__update`;

        // Setting subscriber
        const unsubscriberItem: { unsubscriber?: ReturnType<typeof subscribe> } = {};
        const setWatchNormalize = (newValue: PartialDataAndArray<GetIdType<Entities[EntityKey]>>) => {
          unsubscriberItem.unsubscriber = subscribe(modelKey, newValue, () => {
            runInAction(() => {
              set(store, {
                [normalizeUpdateKey]: Math.random() // force update {observerKey}
              });
            });
          });
        }

        const initialValue: PartialDataAndArray<GetIdType<Entities[EntityKey]>> = Array.isArray(storeObject[observerKey]) ? [] : undefined;
        setWatchNormalize(initialValue);

        Object.assign(storeObject, {
          [normalizeObserverKey]: initialValue,
          [normalizeUpdateKey]: 0
        });

        Object.defineProperty(storeObject, observerKey, {
          get() {
            get(store, normalizeUpdateKey); // Trigger for update entitiy
            return denormalize(modelKey, toJS(get(store, normalizeObserverKey)));
          },
          set(newValue?: PartialDataAndArray<GetModelFromEntity<Entities[EntityKey]>>) {
            const jsValue = toJS(newValue);
            if (jsValue) {
              unsubscriberItem.unsubscriber?.();
              const normalizeValue = normalize(modelKey, jsValue);
              setWatchNormalize(normalizeValue);
              set(store, {
                [normalizeObserverKey]: normalizeValue,
                [normalizeUpdateKey]: Math.random()
              });
            }
          }
        });
        unsubscribersRef.current.push(unsubscriberItem);
      }
      return storeObject;
    });

    useEffect(() => {
      return () => {
        unsubscribersRef.current.forEach(({ unsubscriber }) => unsubscriber?.());
      };
    }, []);

    return store;
  }

  return {
    ...station,
    useEntityObservable
  };
}