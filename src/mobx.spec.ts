import { act, render, RenderResult } from '@testing-library/react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { createElement } from 'react';

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
  const { useEntityObservable, useEntitys, produceEntity, entityStore } = configureNormalizeEntityStation(models);
  const useStore = () => useEntityObservable(() => ({
    comments: [] as Comment[],
    get getterComments() {
      return this.comments;
    },
    fetchComments () {
      runInAction(() => {
        this.comments = MOCK_COMMENT_DATA;
      });
    },
    updateUserData (id: number, name: string) {
      produceEntity('users', users => {
        const user = users[id];
        if (user) {
          user.name = name;
        }
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

  afterEach(() => {
    entityStore.destroy();
  });

  describe('useEntityObservable()', () => {
    describe('Test mobx store overwrite property of normalize model', () => {
      let result: RenderResult;
      let store: ReturnType<typeof useStore>;
      beforeEach(() => {
        result = render(createElement(observer(() => {
          const entities = useEntitys();
          store = useStore();
          return (
            createElement('div', null, ...[
              createElement('div', { 'key': 'userCount', 'data-testid': 'userCount' }, Object.keys(entities.users).length),
              createElement('div', { 'key': 'commentCount', 'data-testid': 'commentCount' }, Object.keys(entities.comments).length),
              ...store.comments.map(comment => (
                createElement('div', { 'key': comment.id, 'data-testid': 'commentItem' }, JSON.stringify(comment))
              ))
            ]) 
          );
        })));
      });

      describe('When initialize hook', () => {
        it('Should entities and result is empty', () => {
          expect(result.queryByTestId('userCount')?.textContent).toBe('0');
          expect(result.queryByTestId('commentCount')?.textContent).toBe('0');
          expect(result.queryAllByTestId('commentItem')).toHaveLength(0);
        });
      });

      describe('When modify store', () => {
        beforeEach(() => {
          act(() => {
            store.fetchComments();
          });
        });

        it('Should entities update normalize data', () => {
          expect(result.queryByTestId('userCount')?.textContent).toBe('2');
          expect(result.queryByTestId('commentCount')?.textContent).toBe('4');
        });

        it('Should store set mock comment data', () => {
          expect(result.queryAllByTestId('commentItem')?.map(comment => comment.textContent)).toEqual(MOCK_COMMENT_DATA.map(comment => JSON.stringify(comment)));
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
              store.appendComment(MOCK_NEW_COMMENT);
            });
          });

          it('Entities add new user and comment', () => {
            expect(result.queryByTestId('userCount')?.textContent).toBe('4');
            expect(result.queryByTestId('commentCount')?.textContent).toBe('6');
          });

          it('Store add new comment data', () => {
            expect(result.queryAllByTestId('commentItem')?.map(comment => comment.textContent)).toEqual([...MOCK_COMMENT_DATA, MOCK_NEW_COMMENT].map(comment => JSON.stringify(comment)));
          });
        });

        describe('When dependencies update', () => {
          it('Store comment data is modified', async () => {
            expect(JSON.parse(result.queryAllByTestId('commentItem')[0]?.textContent || '{}')).toHaveProperty(['author', 'name'], 'Minwoo Kang');
            act(() => {
              store.updateUserData(1, '메누캉');
            });
            expect(JSON.parse(result.queryAllByTestId('commentItem')[0]?.textContent || '{}')).toHaveProperty(['author', 'name'], '메누캉');
          });
        });
      });
    });
  });
});