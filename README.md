# React entity normalize station

**Simple and easy** normalize & denormalize entity system with `normalizr`, `jotai` use react hook!

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
