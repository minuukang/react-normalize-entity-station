# React entity normalize station

**Simple and easy, type safe** normalize & denormalize entity building system with [`normalizr`](https://github.com/paularmstrong/normalizr), [`jotai`](https://github.com/pmndrs/jotai), [`zustand`](https://github.com/pmndrs/zustand) and react hook!

## Install

```bash
npm i react-entity-normalize-station --save
```

## Example

### Interface

```ts
export interface User {
  id: number;
  name: string;
}

export interface Comment {
  id: number;
  body: string;
  author: User;
  preview_replys?: Comment[];
}

export interface Post {
  id: number;
  body: string;
  author: User;
  likeCount: number;
  hasMyLike: boolean;
  preview_comments?: Comment[];
}
```

### Configure entity station

```ts
// src/entity.ts
import { configureNormalizeEntityStation, createEntityModel } from 'react-entity-normalize-station';

const users = createEntityModel<User>('users')();
const comments = createEntityModel<Comment>('comments')(self => ({
  preview_replys: [self], // example of recursion using
  author: users
}));
const posts = createEntityModel<Post>('posts')({
  author: users,
  preview_comments: [comments]
});

export const {
  useDenormalize,
  useEntitys,
  useNormalizeEntity,
  useNormalizeHandler
} = configureNormalizeEntityStation({
  users,
  comments,
  posts
});
```

### Usage (fetch data with react-query)

```tsx
import {
  useDenormalize,
  useEntitys,
  useNormalizeEntity,
  useNormalizeHandler
} from './entity';
import { useQuery, useMutation } from 'react-query';

declare const fetchPosts: () => Promise<Post[]>;
declare const toggleLikePost: (postId: number) => Promise<void>;

function Post ({ postId }: { postId: number; }) {
  const [post, setPost] = useDenormalize('posts', postId);
  function toggleLike () {
    setPost({
      ...post,
      likeCount: post.likeCount + (post.hasMyLike ? -1 : 1),
      hasMyLike: !post.hasMyLike
    });
  }
  const likeMutation = useMutation(() => toggleLikePost(post.id), {
    onMutate: toggleLike,
    onError: toggleLike
  });
  return (
    <div>
      {post.body}
      <input
        type="checkbox"
        checked={post.hasMyLike}
        onChange={() => likeMutation.mutate()}
      />
      (Like : {post.likeCount})
    </div>
  )
}

export default Example () {
  const postQuery = useQuery('postQuery', fetchPosts, {
    suspense: true
  });
  const [posts] = useNormalizeEntity('posts', postQuery.data);
  return (
    <div>
      {posts.map(post => <Post post={post} key={post.id} />)}
    </div>
  )
}
```

## API
### `createEntityModel<T>(name): (definition, options) => Entity`

This function is type safe version of [`normalizr(new entity.Schema)`](https://github.com/paularmstrong/normalizr/blob/master/docs/api.md#entitykey-definition---options--). It will be use partial function to set model type at first generic, definition and options type inference at second function.

```ts
// src/entity.ts
import { createEntityModel } from 'react-entity-normalize-station';

const users = createEntityModel<User>('users')({}, {
  idAttribute: 'userId'
});
const comments = createEntityModel<Comment>('comments')(self => ({
  author: users
  reply_preview: [self]
}));
```

### Type `EntityRecord`

This type is interface of entityStore data. If you want to use this type at your project, can use like,

```ts
// src/entity.ts
import type { EntityRecord } from 'react-entity-normalize-station';

const models = { users, comments }; // result of createEntityModel

export type AppEntityRecord = EntityRecord<typeof models>;
```

### `configureNormalizeEntityStation(models) => EntityStation`

This function build entity store, normalize & denormalize functions, entity producer, react custom hooks, initail provider.

```ts
// src/entity.ts
import { configureNormalizeEntityStation } from 'react-entity-normalize-station';

export const {
  entityStore,
  normalize,
  denormalize,
  produceEntity,
  useNormalizeEntity,
  useDenormalize,
  useEntitys,
  NormalizeEntityProvider
} = configureNormalizeEntityStation({
  users,
  comments
});
```

#### EntityStation.`entityStore`

This store create by [`zustand/vanilla`](https://github.com/pmndrs/zustand#using-zustand-without-react). If you want to get state of entity record, subscribe entity change without react, use this store.

```ts
import { entityStore } from 'src/entity.ts';

const unsubscriber = entityStore.subsribe(entities => {
  console.debug('Entity update', { entities });
  // or console.debug('Entity update', { entities: entityStore.getState() });
});
```

#### EntityStation.`normalize(modelKey: EntityKey, data: Model | Model[]) => IdType | IdType[]`

```ts
import { normalize } from 'src/entity.ts';

declare const MOCK_COMMENT: Comment; // { id: number }
declare const MOCK_USER: User; // { userId: string }

// When model id is number
const commentId = normalize('comments', MOCK_COMMENT); // return `number`
const commentIds = normalize('comments', [MOCK_COMMENT]); // return `number[]`

// When model id is string
const userId = normalize('users', MOCK_USER); // return `string`
const userIds = normalize('users', [MOCK_USER]); // return `string[]`
```

* This function work update normalize entity and return id.
* Normalize entity will update `entityStore`.
* This function is type safe of infer Model & id type

#### EntityStation.`denormalize(modelKey: EntityKey, data: IdType | IdType[]) => (Model | undefined) | Model[]`

```ts
import { denormalize } from 'src/entity.ts';

// When model id is number
const comment = denormalize('comments', 1); // return `Comment | undefined`
const comments = denormalize('comments', [1]); // return `Comment[]`

// When model id is string
const user = denormalize('users', 'asdf'); // return `User | undefined`
const users = denormalize('users', ['asdf']); // return `User[]`
```

* This function work denormalize entity store and parameter data
* This function is type safe of infer Model & id type

#### EnityStation.`produceEntity(modelKey: EntityKey, callback: (records: Record<IdType, NormalizeModel>) => unknown) => void`

This function is produce entity record by [`immer`](https://immerjs.github.io/immer/).

```ts
import { produceEntity } from 'src/entity.ts';

produceEntity('comments', comments => {
  const comment = comments[1];
  if (comment) {
    comment.isLike = true;
    comment.likeCount ++;
  }
});
```

#### EntityStation.`useNormalizeEntity(modelKey: EntityKey, data: Model | Model[]) => [(Model | undefined) | Model[]), setter]`

This function similar by EntityStation.`normalize`, but will return denormalize result. You can use at react function component and set the data

```tsx
import { useNormalizeEntity } from 'src/entity.ts';

function CommentList () {
  const commentResult = useSuspenseFetch('https://.../comments'); // This hook is psuedo of fetching data suspense & refresh
  const [comments, setComments] = useNormalizeEntity('comments', commentResult.data);
  const handleRefreshComment = useCallback(async () => {
    await commentResult.refresh();
    setComments(commentResult.data);
  }, []);
  return (
    <div>
      {comments.map(comment => (
        <Comment comment={comment} key={comment.id} />
      ))}
      <button onClick={handleRefreshComment}>Refresh</button>
    </div>
  );
}
```

#### EntityStation.`useDenormalize(modelKey: EntityKey, data: IdType | IdType[]) => [(Model | undefined) | Model[]), setter]`

This function similar by EntityStation.`denormalize`. You can use at react function component and set the data

```tsx
import { useDenormalize } from 'src/entity.ts';

function CommentLikeButton ({ commentId }: { commentId: number }) {
  const [comment, setComment] = useDenormalize('comments', commentId);
  const handleToggleLike = useCallback(() => {
    setComment({
      ...comment,
      isLike: !comment.isLike,
      likeCount: comment.likeCount + (comment.isLike ? -1 : 1)
    });
  }, [comment, setComment]);
  return (
    <CommentLikeIcon
      isLike={comment.isLike}
      onClick={handleToggleLike}
    />
  );
}
```

#### EnityStation.`useEntitys(): EntityRecords`

If you want to use entity records at react hook, use this!

```ts
import { useEntitys } from 'src/entity.ts';

function useEntityUpdateDebug () {
  const entities = useEntitys();
  useEffect(() => {
    console.debug('Entity update!', { entities });
  }, [entities]);
}
```

#### EntityStation.`NormalizeEntityProvider({ initialEntityRecord: EntityRecord }): React.ComponentType`

If you want to initial entity store(like using ssr), using this provider. This provider is not required when you don't need initial entity at your app.

```tsx
import { NormalizeEntityProvider } from 'src/entity.ts';

function App(props) {
  return (
    <NormalizeEntityProvider initialEntityRecord={INITIAL_ENITY_RECORD}>
      {props.children}
    </NormalizeEntityProvider>
  );
}
```