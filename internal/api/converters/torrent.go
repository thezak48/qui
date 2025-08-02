package converters

import (
	"strings"
	
	qbt "github.com/autobrr/go-qbittorrent"
)

// Torrent represents a torrent with camelCase JSON fields for frontend compatibility
type Torrent struct {
	Hash               string   `json:"hash"`
	Name               string   `json:"name"`
	Size               int64    `json:"size"`
	Progress           float64  `json:"progress"`
	DlSpeed            int64    `json:"dlspeed"`
	UpSpeed            int64    `json:"upspeed"`
	Priority           int64    `json:"priority"`
	NumSeeds           int64    `json:"numSeeds"`
	NumLeechs          int64    `json:"numLeechs"`
	Ratio              float64  `json:"ratio"`
	ETA                int64    `json:"eta"`
	State              string   `json:"state"`
	Category           string   `json:"category"`
	Tags               []string `json:"tags"`
	AddedOn            int64    `json:"addedOn"`
	CompletionOn       int64    `json:"completionOn"`
	Tracker            string   `json:"tracker"`
	DlLimit            int64    `json:"dlLimit"`
	UpLimit            int64    `json:"upLimit"`
	Downloaded         int64    `json:"downloaded"`
	Uploaded           int64    `json:"uploaded"`
	DownloadedSession  int64    `json:"downloadedSession"`
	UploadedSession    int64    `json:"uploadedSession"`
	AmountLeft         int64    `json:"amountLeft"`
	SavePath           string   `json:"saveLocation"`
	Completed          int64    `json:"completed"`
	RatioLimit         float64  `json:"ratioLimit"`
	SeenComplete       int64    `json:"seenComplete"`
	LastActivity       int64    `json:"lastActivity"`
	TimeActive         int64    `json:"timeActive"`
	AutoTmm            bool     `json:"autoTmm"`
	TotalSize          int64    `json:"totalSize"`
	MaxRatio           float64  `json:"maxRatio"`
	MaxSeedingTime     int64    `json:"maxSeedingTime"`
	SeedingTimeLimit   int64    `json:"seedingTimeLimit"`
}

// ConvertTorrent converts a qBittorrent torrent to our frontend-compatible format
func ConvertTorrent(qbtTorrent qbt.Torrent) Torrent {
	// Parse tags - qBittorrent returns comma-separated string
	var tags []string
	if qbtTorrent.Tags != "" {
		// Split by comma and trim spaces
		tagParts := strings.Split(qbtTorrent.Tags, ",")
		for _, tag := range tagParts {
			if trimmed := strings.TrimSpace(tag); trimmed != "" {
				tags = append(tags, trimmed)
			}
		}
	}

	return Torrent{
		Hash:              qbtTorrent.Hash,
		Name:              qbtTorrent.Name,
		Size:              qbtTorrent.Size,
		Progress:          qbtTorrent.Progress,
		DlSpeed:           qbtTorrent.DlSpeed,
		UpSpeed:           qbtTorrent.UpSpeed,
		Priority:          qbtTorrent.Priority,
		NumSeeds:          qbtTorrent.NumSeeds,
		NumLeechs:         qbtTorrent.NumLeechs,
		Ratio:             qbtTorrent.Ratio,
		ETA:               qbtTorrent.ETA,
		State:             string(qbtTorrent.State),
		Category:          qbtTorrent.Category,
		Tags:              tags,
		AddedOn:           qbtTorrent.AddedOn,
		CompletionOn:      qbtTorrent.CompletionOn,
		Tracker:           qbtTorrent.Tracker,
		DlLimit:           qbtTorrent.DlLimit,
		UpLimit:           qbtTorrent.UpLimit,
		Downloaded:        qbtTorrent.Downloaded,
		Uploaded:          qbtTorrent.Uploaded,
		DownloadedSession: qbtTorrent.DownloadedSession,
		UploadedSession:   qbtTorrent.UploadedSession,
		AmountLeft:        qbtTorrent.AmountLeft,
		SavePath:          qbtTorrent.SavePath,
		Completed:         qbtTorrent.Completed,
		RatioLimit:        qbtTorrent.RatioLimit,
		SeenComplete:      qbtTorrent.SeenComplete,
		LastActivity:      qbtTorrent.LastActivity,
		TimeActive:        qbtTorrent.TimeActive,
		AutoTmm:           qbtTorrent.AutoManaged,
		TotalSize:         qbtTorrent.TotalSize,
		MaxRatio:          qbtTorrent.MaxRatio,
		MaxSeedingTime:    qbtTorrent.MaxSeedingTime,
		SeedingTimeLimit:  qbtTorrent.SeedingTimeLimit,
	}
}

// ConvertTorrents converts a slice of qBittorrent torrents
func ConvertTorrents(qbtTorrents []qbt.Torrent) []Torrent {
	torrents := make([]Torrent, len(qbtTorrents))
	for i, qbtTorrent := range qbtTorrents {
		torrents[i] = ConvertTorrent(qbtTorrent)
	}
	return torrents
}