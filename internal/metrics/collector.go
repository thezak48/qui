// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package metrics

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog/log"

	"github.com/autobrr/qui/internal/qbittorrent"
)

type TorrentCollector struct {
	syncManager *qbittorrent.SyncManager
	clientPool  *qbittorrent.ClientPool

	// Instance status metrics
	instanceUpDesc               *prometheus.Desc
	instanceConnectedDesc        *prometheus.Desc
	instanceFirewalledDesc       *prometheus.Desc
	instanceConnectionStatusDesc *prometheus.Desc

	// DHT and peer metrics
	dhtNodesDesc             *prometheus.Desc
	totalPeerConnectionsDesc *prometheus.Desc

	// Transfer rate metrics
	downloadSpeedDesc *prometheus.Desc
	uploadSpeedDesc   *prometheus.Desc

	// Session data metrics (counters)
	dlInfoDataDesc *prometheus.Desc
	upInfoDataDesc *prometheus.Desc
	alltimeDlDesc  *prometheus.Desc
	alltimeUlDesc  *prometheus.Desc

	// Torrent count metrics by status
	torrentsDownloadingDesc *prometheus.Desc
	torrentsSeedingDesc     *prometheus.Desc
	torrentsPausedDesc      *prometheus.Desc
	torrentsErrorDesc       *prometheus.Desc
	torrentsCheckingDesc    *prometheus.Desc
	torrentsCountDesc       *prometheus.Desc

	// Per-torrent metrics (optional)
	torrentSizeDesc       *prometheus.Desc
	torrentDownloadedDesc *prometheus.Desc

	// Error tracking
	scrapeErrorsDesc *prometheus.Desc
}

func NewTorrentCollector(syncManager *qbittorrent.SyncManager, clientPool *qbittorrent.ClientPool) *TorrentCollector {
	return &TorrentCollector{
		syncManager: syncManager,
		clientPool:  clientPool,

		// Instance status metrics
		instanceUpDesc: prometheus.NewDesc(
			"qbittorrent_up",
			"Whether the qBittorrent server is answering requests from this exporter. A version label with the server version is added.",
			[]string{"instance_id", "instance_name", "version"},
			nil,
		),
		instanceConnectedDesc: prometheus.NewDesc(
			"qbittorrent_connected",
			"Whether the qBittorrent server is connected to the BitTorrent network.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		instanceFirewalledDesc: prometheus.NewDesc(
			"qbittorrent_firewalled",
			"Whether the qBittorrent server is connected to the BitTorrent network but is behind a firewall.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		instanceConnectionStatusDesc: prometheus.NewDesc(
			"qbittorrent_instance_connection_status",
			"Connection status of qBittorrent instance (1=connected, 0=disconnected)",
			[]string{"instance_id", "instance_name"},
			nil,
		),

		// DHT and peer metrics
		dhtNodesDesc: prometheus.NewDesc(
			"qbittorrent_dht_nodes",
			"Number of DHT nodes connected to.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		totalPeerConnectionsDesc: prometheus.NewDesc(
			"qbittorrent_total_peer_connections",
			"Total number of peer connections.",
			[]string{"instance_id", "instance_name"},
			nil,
		),

		// Transfer rate metrics
		downloadSpeedDesc: prometheus.NewDesc(
			"qbittorrent_download_speed_bytes_per_second",
			"Current download speed in bytes per second by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		uploadSpeedDesc: prometheus.NewDesc(
			"qbittorrent_upload_speed_bytes_per_second",
			"Current upload speed in bytes per second by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),

		// Session data metrics (counters)
		dlInfoDataDesc: prometheus.NewDesc(
			"qbittorrent_dl_info_data_total",
			"Data downloaded since the server started, in bytes.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		upInfoDataDesc: prometheus.NewDesc(
			"qbittorrent_up_info_data_total",
			"Data uploaded since the server started, in bytes.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		alltimeDlDesc: prometheus.NewDesc(
			"qbittorrent_alltime_dl_total",
			"Total historical data downloaded, in bytes.",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		alltimeUlDesc: prometheus.NewDesc(
			"qbittorrent_alltime_ul_total",
			"Total historical data uploaded, in bytes.",
			[]string{"instance_id", "instance_name"},
			nil,
		),

		// Torrent count metrics by status
		torrentsDownloadingDesc: prometheus.NewDesc(
			"qbittorrent_torrents_downloading",
			"Number of downloading torrents by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		torrentsSeedingDesc: prometheus.NewDesc(
			"qbittorrent_torrents_seeding",
			"Number of seeding torrents by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		torrentsPausedDesc: prometheus.NewDesc(
			"qbittorrent_torrents_paused",
			"Number of paused torrents by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		torrentsErrorDesc: prometheus.NewDesc(
			"qbittorrent_torrents_error",
			"Number of torrents in error state by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		torrentsCheckingDesc: prometheus.NewDesc(
			"qbittorrent_torrents_checking",
			"Number of torrents being checked by instance",
			[]string{"instance_id", "instance_name"},
			nil,
		),
		torrentsCountDesc: prometheus.NewDesc(
			"qbittorrent_torrents_count",
			"Number of torrents for each category and status. Example: qbittorrent_torrents_count{category=\"movies\",status=\"downloading\"}",
			[]string{"instance_id", "instance_name", "category", "status"},
			nil,
		),

		// Per-torrent metrics (optional, disabled by default to avoid high cardinality)
		torrentSizeDesc: prometheus.NewDesc(
			"qbittorrent_torrent_size",
			"Size of the torrent",
			[]string{"instance_id", "instance_name", "name", "category"},
			nil,
		),
		torrentDownloadedDesc: prometheus.NewDesc(
			"qbittorrent_torrent_downloaded",
			"Downloaded data for the torrent",
			[]string{"instance_id", "instance_name", "name", "category"},
			nil,
		),

		// Error tracking
		scrapeErrorsDesc: prometheus.NewDesc(
			"qbittorrent_scrape_errors_total",
			"Total number of scrape errors by instance",
			[]string{"instance_id", "instance_name", "type"},
			nil,
		),
	}
}

func (c *TorrentCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.instanceUpDesc
	ch <- c.instanceConnectedDesc
	ch <- c.instanceFirewalledDesc
	ch <- c.instanceConnectionStatusDesc
	ch <- c.dhtNodesDesc
	ch <- c.totalPeerConnectionsDesc
	ch <- c.downloadSpeedDesc
	ch <- c.uploadSpeedDesc
	ch <- c.dlInfoDataDesc
	ch <- c.upInfoDataDesc
	ch <- c.alltimeDlDesc
	ch <- c.alltimeUlDesc
	ch <- c.torrentsDownloadingDesc
	ch <- c.torrentsSeedingDesc
	ch <- c.torrentsPausedDesc
	ch <- c.torrentsErrorDesc
	ch <- c.torrentsCheckingDesc
	ch <- c.torrentsCountDesc
	ch <- c.torrentSizeDesc
	ch <- c.torrentDownloadedDesc
	ch <- c.scrapeErrorsDesc
}

func (c *TorrentCollector) reportError(ch chan<- prometheus.Metric, instanceIDStr, instanceName, errorType string) {
	ch <- prometheus.MustNewConstMetric(
		c.scrapeErrorsDesc,
		prometheus.CounterValue,
		1,
		instanceIDStr,
		instanceName,
		errorType,
	)
}

func (c *TorrentCollector) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if c.clientPool == nil {
		log.Debug().Msg("ClientPool is nil, skipping metrics collection")
		return
	}

	instances := c.clientPool.GetAllInstances(ctx)

	log.Debug().Int("instances", len(instances)).Msg("Collecting metrics for instances")

	for _, instance := range instances {
		instanceIDStr := instance.IDString()
		instanceName := instance.Name

		client, err := c.clientPool.GetClient(ctx, instance.ID)
		connected := 0.0
		if err == nil && c.clientPool.IsHealthy(instance.ID) {
			connected = 1.0
		}

		// Always report connection status
		ch <- prometheus.MustNewConstMetric(
			c.instanceConnectionStatusDesc,
			prometheus.GaugeValue,
			connected,
			instanceIDStr,
			instanceName,
		)

		if connected == 0 {
			// Report instance as down
			ch <- prometheus.MustNewConstMetric(
				c.instanceUpDesc,
				prometheus.GaugeValue,
				0,
				instanceIDStr,
				instanceName,
				"unknown",
			)

			log.Debug().
				Err(err).
				Int("instanceID", instance.ID).
				Str("instanceName", instanceName).
				Msg("Skipping metrics for disconnected instance")
			continue
		}

		// Get server version
		version := "unknown"
		if client != nil {
			if v, err := client.GetVersion(ctx); err == nil {
				version = v
			}
		}

		// Report instance as up
		ch <- prometheus.MustNewConstMetric(
			c.instanceUpDesc,
			prometheus.GaugeValue,
			1,
			instanceIDStr,
			instanceName,
			version,
		)

		if c.syncManager == nil {
			log.Debug().Msg("SyncManager is nil, skipping detailed metrics")
			continue
		}

		// Get server state for detailed metrics
		serverState, err := c.syncManager.GetServerState(ctx, instance.ID)
		if err != nil {
			log.Warn().
				Err(err).
				Int("instanceID", instance.ID).
				Str("instanceName", instanceName).
				Msg("Failed to get server state for metrics")
			c.reportError(ch, instanceIDStr, instanceName, "server_state")
		} else if serverState != nil {
			// Connection status metrics
			connectionStatus := serverState.ConnectionStatus
			ch <- prometheus.MustNewConstMetric(
				c.instanceConnectedDesc,
				prometheus.GaugeValue,
				boolToFloat(connectionStatus == "connected"),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.instanceFirewalledDesc,
				prometheus.GaugeValue,
				boolToFloat(connectionStatus == "firewalled"),
				instanceIDStr,
				instanceName,
			)

			// DHT and peer metrics
			ch <- prometheus.MustNewConstMetric(
				c.dhtNodesDesc,
				prometheus.GaugeValue,
				float64(serverState.DHTNodes),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.totalPeerConnectionsDesc,
				prometheus.GaugeValue,
				float64(serverState.TotalPeerConnections),
				instanceIDStr,
				instanceName,
			)

			// Session data counters
			ch <- prometheus.MustNewConstMetric(
				c.dlInfoDataDesc,
				prometheus.CounterValue,
				float64(serverState.DlInfoData),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.upInfoDataDesc,
				prometheus.CounterValue,
				float64(serverState.UpInfoData),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.alltimeDlDesc,
				prometheus.CounterValue,
				float64(serverState.AlltimeDl),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.alltimeUlDesc,
				prometheus.CounterValue,
				float64(serverState.AlltimeUl),
				instanceIDStr,
				instanceName,
			)
		}

		// Torrent counts by status
		counts, err := c.syncManager.GetTorrentCounts(ctx, instance.ID)
		if err != nil {
			log.Warn().
				Err(err).
				Int("instanceID", instance.ID).
				Str("instanceName", instanceName).
				Msg("Failed to get torrent counts for metrics")
			c.reportError(ch, instanceIDStr, instanceName, "torrent_counts")
		} else if counts != nil && counts.Status != nil {
			if downloading, ok := counts.Status["downloading"]; ok {
				ch <- prometheus.MustNewConstMetric(
					c.torrentsDownloadingDesc,
					prometheus.GaugeValue,
					float64(downloading),
					instanceIDStr,
					instanceName,
				)
			}

			if seeding, ok := counts.Status["seeding"]; ok {
				ch <- prometheus.MustNewConstMetric(
					c.torrentsSeedingDesc,
					prometheus.GaugeValue,
					float64(seeding),
					instanceIDStr,
					instanceName,
				)
			}

			if paused, ok := counts.Status["paused"]; ok {
				ch <- prometheus.MustNewConstMetric(
					c.torrentsPausedDesc,
					prometheus.GaugeValue,
					float64(paused),
					instanceIDStr,
					instanceName,
				)
			}

			if errored, ok := counts.Status["errored"]; ok {
				ch <- prometheus.MustNewConstMetric(
					c.torrentsErrorDesc,
					prometheus.GaugeValue,
					float64(errored),
					instanceIDStr,
					instanceName,
				)
			}

			if checking, ok := counts.Status["checking"]; ok {
				ch <- prometheus.MustNewConstMetric(
					c.torrentsCheckingDesc,
					prometheus.GaugeValue,
					float64(checking),
					instanceIDStr,
					instanceName,
				)
			}
		}

		// Transfer speeds
		speeds, err := c.syncManager.GetInstanceSpeeds(ctx, instance.ID)
		if err != nil {
			log.Warn().
				Err(err).
				Int("instanceID", instance.ID).
				Str("instanceName", instanceName).
				Msg("Failed to get instance speeds for metrics")
			c.reportError(ch, instanceIDStr, instanceName, "instance_speeds")
		} else if speeds != nil {
			ch <- prometheus.MustNewConstMetric(
				c.downloadSpeedDesc,
				prometheus.GaugeValue,
				float64(speeds.Download),
				instanceIDStr,
				instanceName,
			)

			ch <- prometheus.MustNewConstMetric(
				c.uploadSpeedDesc,
				prometheus.GaugeValue,
				float64(speeds.Upload),
				instanceIDStr,
				instanceName,
			)
		}

		// Torrent counts by category and status
		categoryCounts, err := c.syncManager.GetTorrentCountsByCategory(ctx, instance.ID)
		if err != nil {
			log.Warn().
				Err(err).
				Int("instanceID", instance.ID).
				Str("instanceName", instanceName).
				Msg("Failed to get torrent counts by category for metrics")
			c.reportError(ch, instanceIDStr, instanceName, "category_counts")
		} else if categoryCounts != nil {
			for category, statusCounts := range categoryCounts {
				for status, count := range statusCounts {
					ch <- prometheus.MustNewConstMetric(
						c.torrentsCountDesc,
						prometheus.GaugeValue,
						float64(count),
						instanceIDStr,
						instanceName,
						category,
						status,
					)
				}
			}
		}

		log.Debug().
			Int("instanceID", instance.ID).
			Str("instanceName", instanceName).
			Msg("Collected metrics for instance")
	}
}

func boolToFloat(b bool) float64 {
	if b {
		return 1.0
	}
	return 0.0
}
