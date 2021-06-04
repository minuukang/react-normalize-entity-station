import { schema, normalize } from 'normalizr';
import { act, renderHook, RenderHookResult } from '@testing-library/react-hooks';
import { Draft } from 'immer';

import { createEntityModel, configureNormalizeEntityStation } from './index';
import { User, Comment, MOCK_COMMENT_DATA } from './__mocks__';
import { createElement } from 'react';

describe('NormalizeEntityStation', () => {
  describe('createEntityModel() spec', () => {
    let schemaCreator: ReturnType<typeof createEntityModel>;

    beforeEach(() => {
      schemaCreator = createEntityModel('foo');
    });

    it('Should create function when just call createEntityModel()', () => {
      expect(typeof schemaCreator).toBe('function');
    });

    it('Should create schema when call curring', () => {
      expect(schemaCreator()).toBeInstanceOf(schema.Entity);
    });

    it('Should schema has correct key', () => {
      expect(schemaCreator().key).toBe('foo');
    });
  });

  describe('configureNormalizeEntityStation()', () => {
    function configure<V>(callback: (configure: ReturnType<typeof configureNormalizeEntityStation>) => V) {
      const users = createEntityModel<User>('users')();
      const comments = createEntityModel<Comment>('comments')(self => ({
        author: users,
        reply_preview: [self]
      }));
      const config = configureNormalizeEntityStation({
        users,
        comments
      });
      let hook: RenderHookResult<unknown, V>;
      hook = renderHook(() => {
        return callback(config as unknown as ReturnType<typeof configureNormalizeEntityStation>);
      }, {
        wrapper: props => createElement(config.NormalizeEntityProvider, {
          ...props,
          initialEntityRecord: normalize(MOCK_COMMENT_DATA, [comments]).entities as any
        })
      });
      return hook!;
    }

    describe('Test useEntitys', () => {
      it('Should entityRecord have correct entity lengths', () => {
        const hook = configure(config => {
          const entities = config.useEntitys();
          return {
            entities,
          }
        });
        expect(Object.keys(hook.result.current.entities.users)).toHaveLength(2);
        expect(Object.keys(hook.result.current.entities.comments)).toHaveLength(4);
      });
    });

    describe('Test useNormalizeHandler', () => {
      let hook: RenderHookResult<unknown, { user: User; normalizeHandler(k: string, user: User): void; }>;

      beforeEach(() => {
        hook = configure(config => {
          const normalizeHandler = config.normalize;
          const [user] = config.useDenormalize('users', 1);
          return {
            user: user as User,
            normalizeHandler
          }
        });
      });

      describe('When entityRecord is changed', () => {
        it('Should normalizeEntity result reference is changed', () => {
          const oldUser = hook.result.current.user;
          act(() => {
            hook.result.current.normalizeHandler('users', {
              id: 1,
              name: '메누캉'
            });
          });
          expect(oldUser === hook.result.current.user).toBe(false);
        });
      });

      describe('When entityRecord is not changed', () => {
        it('Should normalizeEntity result reference is keeped', () => {
          const oldUser = hook.result.current.user;
          act(() => {
            hook.result.current.normalizeHandler('users', {
              id: 1,
              name: 'Minwoo Kang'
            });
          });
          expect(oldUser === hook.result.current.user).toBe(true);
        });
      });
    });

    describe('Test produceEntity', () => {
      let produce: any;
      let hook: RenderHookResult<unknown, { user: User }>;

      beforeEach(() => {
        hook = configure(config => {
          const [user] = config.useDenormalize('users', 1);
          produce = config.produceEntity;
          return {
            user: user as User,
          }
        });
      });

      describe('When entityRecord is changed', () => {
        it('Should normalizeEntity result reference is changed', () => {
          const oldUser = hook.result.current.user;
          act(() => {
            produce('users', (users: Draft<Record<string, User>>) => {
              const user = users[1];
              if (user) {
                user.name = '메누캉'
              }
            });
          });
          expect(oldUser === hook.result.current.user).toBe(false);
        });
      });

      describe('When entityRecord is not changed', () => {
        it('Should normalizeEntity result reference is keeped', () => {
          const oldUser = hook.result.current.user;
          act(() => {
            produce('users', (users: Draft<Record<string, User>>) => {
              const user = users[1];
              if (user) {
                user.name = 'Minwoo Kang'
              }
            });
          });
          expect(oldUser === hook.result.current.user).toBe(true);
        });
      });
    });

    describe('Test useDenormalize', () => {
      describe('When give single value', () => {
        it('Should return & update correct single value', () => {
          const hook = configure(config => {
            const [singleUser, setUser] = config.useDenormalize('users', 1);
            const [comment] = config.useDenormalize('comments', 1);
            return {
              singleUser,
              comment,
              updateUser() {
                setUser({
                  ...singleUser as User,
                  name: '무야호'
                });
              }
            }
          });
          expect(hook.result.current.singleUser).toHaveProperty('name', 'Minwoo Kang');
          expect(hook.result.current.comment).toHaveProperty(['author', 'name'], 'Minwoo Kang');
          act(() => {
            hook.result.current.updateUser();
          });
          expect(hook.result.current.singleUser).toHaveProperty('name', '무야호');
          expect(hook.result.current.comment).toHaveProperty(['author', 'name'], '무야호');
        });
      });

      describe('When give array value', () => {
        it('Should return correct muliple value', () => {
          const commentIds = [1, 2];
          const hook = configure(config => {
            const [comments] = config.useDenormalize('comments', commentIds);
            return {
              comments,
            }
          });
          expect(hook.result.current.comments).toHaveLength(2);
          expect(hook.result.current.comments).toHaveProperty([0, 'author', 'name'], 'Minwoo Kang');
          expect(hook.result.current.comments).toHaveProperty([1, 'author', 'name'], 'BTS');
        });
      });
    });
  });
});