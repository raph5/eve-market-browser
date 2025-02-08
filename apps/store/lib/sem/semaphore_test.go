package sem

import (
	"fmt"
	"math/rand"
	"slices"
	"testing"
	"time"
)

func printQueue(queue *node) {
	s := "["
	for n := queue; n != nil; n = n.next {
		if n.next == nil {
			s += fmt.Sprintf("%d", n.priority)
		} else {
			s += fmt.Sprintf("%d, ", n.priority)
		}
	}
	s += "]"
	fmt.Println(s)
}

func TestAcquireRelease(t *testing.T) {
	s := New(3)
	endCh := make(chan struct{})
	task := func(priority int) {
		thread := s.Acquire(priority)
		<-endCh
		s.Release(thread)
	}

	go task(2)
	time.Sleep(1 * time.Millisecond)
	go task(9)
	time.Sleep(1 * time.Millisecond)
	go task(4)
	time.Sleep(1 * time.Millisecond)
	go task(2)
	time.Sleep(1 * time.Millisecond)
	go task(0)
	time.Sleep(1 * time.Millisecond)
	go task(8)
	time.Sleep(1 * time.Millisecond)
	go task(1)
	time.Sleep(1 * time.Millisecond)

	es := sem{ // expected semaphore
		threads: []int{1, 2, 3},
		queue: &node{
			priority: 8,
			next: &node{
				priority: 2,
				next: &node{
					priority: 1,
					next: &node{
						priority: 0,
					},
				},
			},
		},
	}

	if !slices.Equal(es.threads, s.threads) {
		t.Fatalf("expected threads = %v, got %v", es.threads, s.threads)
	}

	var n, en *node
	for n, en = s.queue, es.queue; en != nil && n != nil; n, en = n.next, en.next {
		if n.priority != en.priority {
			t.Fatalf("expected priority = %v, got %v", en.priority, n.priority)
		}
	}
	if n != nil || en != nil {
		t.Fatalf("expected same queue length, got n = %v and en = %v", n, en)
	}

	close(endCh)
	time.Sleep(1 * time.Millisecond)

	es = sem{
		threads: []int{-1, -1, -1},
		queue:   nil,
	}

	if !slices.Equal(s.threads, es.threads) {
		t.Fatalf("expected threads = %v, got %v", es.threads, s.threads)
	}
	if s.queue != es.queue {
		t.Fatalf("expected queue = %v, got %v", es.queue, s.queue)
	}
}

func TestLoad(t *testing.T) {
	n := 1000
	m := 20

	s := New(10)
	r := rand.New(rand.NewSource(123))
	tasks := make([]int, n)
	for i := 0; i < n; i++ {
		tasks[i] = i
	}

	for j := 0; j < m; j++ {
		r.Shuffle(n, func(i, j int) {
			tasks[i], tasks[j] = tasks[j], tasks[i]
		})

		for _, t := range tasks {
			go func(t int) {
				thread := s.Acquire(t)
				s.Release(thread)
			}(t)
		}
		time.Sleep(1 * time.Millisecond)

		es := sem{
			threads: []int{-1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
			queue:   nil,
		}

		if !slices.Equal(s.threads, es.threads) {
			t.Fatalf("expected threads = %v, got %v", es.threads, s.threads)
		}
		if s.queue != es.queue {
			t.Fatalf("expected queue = %v, got %v", es.queue, s.queue)
		}
	}
}
