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
  threads []int
  queue *node
  mu sync.Mutex
}

func New(threadsCount int) *sem {
  threads := make([]int, threadsCount)
  for i := range threads {
    threads[i] = -1;
  }
  return &sem{threads: threads}
}

func (s *sem) Acquire(priority int) int {
  newThread := getNewThread()
  s.mu.Lock()
  for i := range s.threads {
    if s.threads[i] == -1 {
      s.threads[i] = newThread
      s.mu.Unlock()
      return newThread
    }
  }

  for {
    ch := make(chan struct{})
    node := &node{priority: priority, ch: ch}
    push(&s.queue, node)
    s.mu.Unlock()

    <-ch
    s.mu.Lock()
    for i := range s.threads {
      if s.threads[i] == -1 {
        s.threads[i] = newThread
        s.mu.Unlock()
        return newThread
      }
    }
  }
}

func (s *sem) AcquireWithContext(ctx context.Context, priority int) (int, error) {
  newThread := getNewThread()
  s.mu.Lock()
  for i := range s.threads {
    if s.threads[i] == -1 {
      s.threads[i] = newThread
      s.mu.Unlock()
      return newThread, nil
    }
  }

  for {
    ch := make(chan struct{})
    node := &node{priority: priority, ch: ch}
    push(&s.queue, node)
    s.mu.Unlock()

    select {
    case <-ch:
    case <-ctx.Done():
      s.mu.Lock()
      remove(&s.queue, node)
      s.mu.Unlock()
      return -1, context.Canceled
    }
    s.mu.Lock()
    for i := range s.threads {
      if s.threads[i] == -1 {
        s.threads[i] = newThread
        s.mu.Unlock()
        return newThread, nil
      }
    }
  }
}

func (s *sem) Release(thread int) {
  if thread == -1 {
    panic("custom semaphore: trying to release thread -1")
  }

  s.mu.Lock()
  for i := range s.threads {
    if s.threads[i] == thread {
      s.threads[i] = -1
      if s.queue != nil {
        ch := pop(&s.queue)
        close(ch)
      }
    }
  }
  s.mu.Unlock()
}

var threadId int = 0
func getNewThread() int {
  if threadId == -2 {
    threadId += 2
  } else {
    threadId += 1
  }
  return threadId
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
