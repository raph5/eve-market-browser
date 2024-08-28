// Custom implementation of a semaphore
//
// This implementation of a semaphore manage the access to N "threads". To
// acquire a "threads" you must do blocking request to the semaphore. Each
// request has a pripority given by the user. In case all the "threads" are
// occupied the highests priority requests will be resolved first.
// I quoted the word thread because it does not relate to any actual thread,
// Here the threads are just the absract item that the semaphore manage.
package sem

import (
	"context"
	"sync"
)

type sem struct {
  threads int
  freeThreads int
  queue *node
  mu sync.Mutex
}

func New(threads int) *sem {
  return &sem{
    threads: threads,
    freeThreads: threads,
  }
}

func (s *sem) Acquire(priority int) {
  s.mu.Lock()
  if s.freeThreads > 0 {
    s.freeThreads -= 1
    s.mu.Unlock()
    return
  }
  ch := make(chan struct{})
  node := &node{priority: priority, ch: ch}
  push(&s.queue, node)
  s.mu.Unlock()
  <-ch
}

func (s *sem) AcquireWithContext(ctx context.Context, priority int) error {
  s.mu.Lock()
  if s.freeThreads > 0 {
    s.freeThreads -= 1
    s.mu.Unlock()
    return nil
  }
  ch := make(chan struct{})
  node := &node{priority: priority, ch: ch}
  push(&s.queue, node)
  s.mu.Unlock()
  select {
  case <-ch:
    return nil
  case <-ctx.Done():
    s.mu.Lock()
    remove(&s.queue, node)
    s.mu.Unlock()
    return context.Canceled
  }
}

func (s *sem) Release() {
  s.mu.Lock()
  if s.queue == nil {
    if s.freeThreads < s.threads {
      s.freeThreads += 1
    }
    s.mu.Unlock()
    return
  }
  ch := pop(&s.queue)
  s.mu.Unlock()
  close(ch)
}

// TODO: remove
func (s *sem) GetFreeThreads() int {
  return s.freeThreads
}

type node struct {
  priority int
  ch chan struct{}
  next *node
}

func push(queue **node, node *node) {
  n := *queue
  if n == nil {
    *queue = node
    return
  }
  if node.priority > n.priority {
    node.next = n
    *queue = node
    return
  }
  for n.next != nil && node.priority <= n.priority {
    n = n.next
  }
  node.next = n.next
  n.next = node
}

func pop(queue **node) chan struct{} {
n := *queue
  *queue = n.next
  return n.ch
}

func remove(queue **node, node *node) {
  if *queue == node {
    *queue = node.next
    return
  }
  for n := *queue; n != nil; n = n.next {
    if n.next == node {
      n.next = n.next.next
      return
    }
  }
}
