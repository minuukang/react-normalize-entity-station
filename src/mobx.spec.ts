import { act, renderHook, RenderHookResult } from '@testing-library/react-hooks';
import { runInAction } from 'mobx';
import { EntityRecord } from '.';

import { configureNormalizeEntityStation, createEntityModel } from './mobx';
import { User, Comment, MOCK_COMMENT_DATA } from './__mocks__';

describe('MobX integration test', () => {
  const users = createEntityModel<User>('users')();
  const comments = createEntityModel<Comment>('comments')(self => ({
    author: users,
    reply_preview: [self]
  }));
  const models = {
    users,
    comments,
  };

  describe('useEntityObservable()', () => {
    describe('Test mobx store overwrite property of normalize model', () => {
      let hook: RenderHookResult<unknown, {
        store: { comments: Comment[], fetchComments(): void, appendComment(comment: Comment): void };
        entities: EntityRecord<typeof models>;
      }>;

      beforeEach(() => {
        const { useEntityObservable, useEntitys } = configureNormalizeEntityStation(models);
        act(() => {
          hook = renderHook(() => {
            const entities = useEntitys();
            const store = useEntityObservable(() => ({
              comments: [] as Comment[],
              fetchComments () {
                runInAction(() => {
                  this.comments = MOCK_COMMENT_DATA;
                });
              },
              appendComment (newComment: Comment) {
                runInAction(() => {
                  this.comments = [
                    ...this.comments,
                    newComment
                  ];
                });
              }
            }), {
              comments: 'comments'
            });
            return {
              store,
              entities,
              comments
            };
          });
        });
      });

      describe('When initialize hook', () => {
        it('Should entities and result is empty', () => {
          expect(Object.keys(hook.result.current.entities.users)).toHaveLength(0);
          expect(Object.keys(hook.result.current.entities.comments)).toHaveLength(0);
          expect(hook.result.current.store.comments).toEqual([]);
        });
      });

      describe('When modify store', () => {
        beforeEach(() => {
          act(() => {
            hook.result.current.store.fetchComments();
          });
        });

        it('Should entities update normalize data', () => {
          expect(Object.keys(hook.result.current.entities.users)).toHaveLength(2);
          expect(Object.keys(hook.result.current.entities.comments)).toHaveLength(4);
        });

        it('Should store set mock comment data', () => {
          expect(hook.result.current.store.comments).toEqual(MOCK_COMMENT_DATA);
        });

        describe('When append data', () => {
          const MOCK_NEW_COMMENT: Comment = {
            id: 343434,
            author: {
              id: 45345345,
              name: 'NEW USER'
            },
            body: 'NEW COMMENT',
            reply_preview: [
              { id: 455656, author: { id: 234234234, name: 'ReplyUser' }, body: 'reply' }
            ]
          }

          beforeEach(() => {
            act(() => {
              hook.result.current.store.appendComment(MOCK_NEW_COMMENT);
            });
          });

          it('Entities add new user and comment', () => {
            expect(Object.keys(hook.result.current.entities.users)).toHaveLength(4);
            expect(Object.keys(hook.result.current.entities.comments)).toHaveLength(6);
          });

          it('Store add new comment data', () => {
            expect(hook.result.current.store.comments).toEqual([
              ...MOCK_COMMENT_DATA,
              MOCK_NEW_COMMENT
            ]);
          });
        });
      });
    });
  });
});