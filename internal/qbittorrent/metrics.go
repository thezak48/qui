// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package qbittorrent

import (
	"context"
	"strconv"

	"github.com/rs/zerolog/log"
)

type InstanceInfo struct {
	ID   int
	Name string
}

func (i *InstanceInfo) IDString() string {
	return strconv.Itoa(i.ID)
}

type ServerState struct {
	ConnectionStatus     string `json:"connection_status"`
	DHTNodes             int64  `json:"dht_nodes"`
	TotalPeerConnections int64  `json:"total_peer_connections"`
	DlInfoData           int64  `json:"dl_info_data"`
	UpInfoData           int64  `json:"up_info_data"`
	AlltimeDl            int64  `json:"alltime_dl"`
	AlltimeUl            int64  `json:"alltime_ul"`
}

func (cp *ClientPool) GetAllInstances(ctx context.Context) []*InstanceInfo {
	instances, err := cp.instanceStore.List(ctx, false)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get instances for metrics")
		return nil
	}

	var result []*InstanceInfo
	for _, instance := range instances {
		result = append(result, &InstanceInfo{
			ID:   instance.ID,
			Name: instance.Name,
		})
	}

	return result
}

func (cp *ClientPool) IsHealthy(instanceID int) bool {
	cp.mu.RLock()
	defer cp.mu.RUnlock()

	client, exists := cp.clients[instanceID]
	if !exists {
		return false
	}

	return client.IsHealthy()
}
