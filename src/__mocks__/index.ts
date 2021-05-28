export interface User {
  id: number;
  name: string;
}

export interface Comment {
  id: number;
  body: string;
  author: User;
  reply_preview?: Comment[];
}

export const MOCK_USER_DATA: User[] = [
  {
    id: 1,
    name: 'Minwoo Kang'
  },
  {
    id: 2,
    name: 'BTS'
  }
]

export const MOCK_COMMENT_DATA: Comment[] = [
  {
    id: 1,
    body: 'first comment',
    author: MOCK_USER_DATA[0],
    reply_preview: [
      {
        id: 45,
        body: 'first reply',
        author: MOCK_USER_DATA[1]
      },
      {
        id: 46,
        body: 'second reply',
        author: MOCK_USER_DATA[0]
      }
    ]
  },
  {
    id: 2,
    body: 'second comment',
    author: MOCK_USER_DATA[1],
    reply_preview: []
  }
]

