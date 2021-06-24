# React entity normalize station

**Simple and easy, type safe** normalize & denormalize entity building system with [`normalizr`](https://github.com/paularmstrong/normalizr), [`jotai`](https://github.com/pmndrs/jotai), [`zustand`](https://github.com/pmndrs/zustand) and react hook!

| ✅ In this document; we call **EntityStation** is about build system(`configureNormalizeEntityStation`) result!

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

### Configure **EntityStation**

```ts
// src/entity-station.ts
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
} from './entity-station';
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

## MobX (`mobx-react-lite`) integration

You can use this package with `mobx-react-lite`,  [`useLocalObservable`](https://github.com/mobxjs/mobx-react#uselocalobservable-hook) to connect entity station.

**Step 1**, import `react-entity-normalize-station/mobx` to configure **EntityStation**! It will be add `useEntityObservable` at the default entity station

```ts
import { configureNormalizeEntityStation } from 'react-entity-normalize-station/mobx';

// ... Model setting (users, comments, posts) ...

export const { useEntityObservable } = configureNormalizeEntityStation({
  users,
  comments,
  posts
});
```

**Step 2**, You can use `useEntityObservable` similar like `useLocalObservable`. But be explicit what property is connect to normalize entity. Typescript will help property setting.

```ts
interface PostStoreInterface {
  currentPosts: Posts[];
  fetchPosts(): Promise<void>;
}

const StoreProvider = () => {
  // const postStore = useLocalObservable(PostStore);
  const postStore = useEntityObservable(PostStore, {
    currentPosts: 'posts'
  });
  // ... set context provider
};
```

Now, the **EntityStation** should intercept original property to change computed value. you can preservation your componentcode base to change it!

### ⚠️ **Warning** to use MobX integration

When using this integration, entity station will change observable value to computed value. That mean you can't use MobX magicall syntax. Let's find out migrate mobx store.

#### Using array case

When you want update the array, the reference will be change.

```ts
// Before
runInAction(() => {
  this.posts.push(newPost);
});

// After
runInAction(() => {
  this.posts = [...this.posts, newPost];
});
```

#### Using object case

When you want update the object, reference will be change or just use `normalize` or `produceEntity` from **EntityStation**.

```ts
// Before
runInAction(() => {
  this.post.isLike = true;
});

// After
import { normalize, produceEntity } from 'src/entity-station.ts';

runInAction(() => {
  this.post = {
    ...this.post,
    isLike: true
  }
  // or
  normalize('posts', {
    ...this.post,
    isLike: true
  });
  // or
  produceEntity('posts', posts => {
    const post = posts[this.post.id];
    if (post) {
      post.isLike = true;
    }
  });
});
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

This type is interface of `entityStore` data. If you want to use this type at your project, can use like,

```ts
// src/entity.ts
import type { EntityRecord } from 'react-entity-normalize-station';

const models = { users, comments }; // result of createEntityModel

export type AppEntityRecord = EntityRecord<typeof models>;
```

### Type `EntityModel`

This type is record of entity model. If you want to use this type at your project, can use like,

```ts
// src/entity.ts
import type { EntityModel } from 'react-entity-normalize-station';

const models = { users, comments }; // result of createEntityModel

export type AppEntityModel = EntityModel<typeof models>;

// ...
type UserTypeFromAppEntityModel = AppEntityModel['users']; // User
type CommentTypeFromAppEntityModel = AppEntityModel['comments']; // User
```

### `configureNormalizeEntityStation(models) => EntityStation`

This function build **EntityStation**. It's create entity store, normalize & denormalize functions, entity producer, react custom hooks, initail provider.

```ts
// src/entity-station.ts
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
import { entityStore } from 'src/entity-station.ts';

const unsubscriber = entityStore.subsribe(entities => {
  console.debug('Entity update', { entities });
  // or console.debug('Entity update', { entities: entityStore.getState() });
});
```

#### EntityStation.`normalize(modelKey: EntityKey, data: Model | Model[]) => IdType | IdType[]`

```ts
import { normalize } from 'src/entity-station.ts';

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
import { denormalize } from 'src/entity-station.ts';

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
import { produceEntity } from 'src/entity-station.ts';

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
import { useNormalizeEntity } from 'src/entity-station.ts';

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

#### EntityStation.`subscribe(modelKey: EntityKey, data: IdType | IdType[]): Unsubscriber(() => void)`

If you want to subscribe change model data, you can use this subscriber. Return type is subscriber function.
This function use at mobx integration.

```tsx
import { subscribe } from 'src/entity.ts';

subscribe('comments', [1, 2, 3], () => {
  console.log('Comment [1, 2, 3] is changed!');
});
```