import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeServerHistoryWithLocalNotices,
  type PersistedChatBubble,
} from './chatHistoryStorage.ts';

const NOTICE = 'Turn stopped: context exhausted.';

function bubble(
  id: string,
  role: 'user' | 'agent',
  content: string,
  notice = false,
): PersistedChatBubble {
  return {
    id,
    role,
    content,
    notice: notice || undefined,
    timestamp: `2026-08-24T00:00:0${id.length}.000Z`,
  };
}

test('server hydration retains one explicitly local terminal notice when the append was missing', () => {
  const server = [bubble('server-user', 'user', 'large request')];
  const local = [
    bubble('local-user', 'user', 'large request'),
    bubble('local-notice', 'agent', NOTICE, true),
  ];

  const merged = mergeServerHistoryWithLocalNotices(server, local);

  assert.deepEqual(
    merged.map(({ role, content, notice }) => ({ role, content, notice })),
    [
      { role: 'user', content: 'large request', notice: undefined },
      { role: 'agent', content: NOTICE, notice: true },
    ],
  );
});

test('server hydration does not duplicate a terminal notice that was committed', () => {
  const server = [
    bubble('server-user', 'user', 'large request'),
    bubble('server-notice', 'agent', NOTICE),
  ];
  const local = [bubble('local-notice', 'agent', NOTICE, true)];

  const merged = mergeServerHistoryWithLocalNotices(server, local);

  assert.equal(merged.filter((message) => message.content === NOTICE).length, 1);
  assert.deepEqual(merged, server);
});

test('server hydration never resurrects ordinary local-only bubbles', () => {
  const server = [bubble('server-user', 'user', 'saved')];
  const local = [bubble('local-agent', 'agent', 'unsaved ordinary reply')];

  assert.deepEqual(mergeServerHistoryWithLocalNotices(server, local), server);
});

test('matching is count-aware across repeated terminal notices', () => {
  const server = [bubble('server-notice', 'agent', NOTICE)];
  const local = [
    bubble('local-notice-1', 'agent', NOTICE, true),
    bubble('local-notice-2', 'agent', NOTICE, true),
  ];

  const merged = mergeServerHistoryWithLocalNotices(server, local);

  assert.equal(merged.filter((message) => message.content === NOTICE).length, 2);
  assert.equal(merged[merged.length - 1]?.id, 'local-notice-2');
});
