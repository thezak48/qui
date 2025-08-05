package qbittorrent

// FilterOptions represents the filter options from the frontend
type FilterOptions struct {
	Status     []string `json:"status"`
	Categories []string `json:"categories"`
	Tags       []string `json:"tags"`
	Trackers   []string `json:"trackers"`
}
