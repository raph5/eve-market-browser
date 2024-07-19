package utils

type JobsQueue[T any] []*Job[T]
type Job[T any] struct {
	Payload T
	Time    int64
}

func (jq *JobsQueue[T]) Len() int {
	return len(*jq)
}

func (jq *JobsQueue[T]) Less(i, j int) bool {
	return (*jq)[i].Time < (*jq)[j].Time
}

func (jq *JobsQueue[T]) Swap(i, j int) {
	(*jq)[i], (*jq)[j] = (*jq)[j], (*jq)[i]
}

func (jq *JobsQueue[T]) Push(x any) {
	job := x.(*Job[T])
	*jq = append(*jq, job)
}

func (jq *JobsQueue[T]) Pop() any {
	oldJq := *jq
	n := len(oldJq)
	j := oldJq[n-1]
	oldJq[n-1] = nil
	*jq = oldJq[0 : n-1]
	return j
}
