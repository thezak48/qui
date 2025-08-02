package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"github.com/s0up4200/qbitweb/internal/models"
	"github.com/s0up4200/qbitweb/internal/qbittorrent"
)

type InstancesHandler struct {
	instanceStore *models.InstanceStore
	clientPool    *qbittorrent.ClientPool
}

func NewInstancesHandler(instanceStore *models.InstanceStore, clientPool *qbittorrent.ClientPool) *InstancesHandler {
	return &InstancesHandler{
		instanceStore: instanceStore,
		clientPool:    clientPool,
	}
}

// CreateInstanceRequest represents a request to create a new instance
type CreateInstanceRequest struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// UpdateInstanceRequest represents a request to update an instance
type UpdateInstanceRequest struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"` // Optional for updates
}

// ListInstances returns all instances
func (h *InstancesHandler) ListInstances(w http.ResponseWriter, r *http.Request) {
	// Check if only active instances are requested
	activeOnly := r.URL.Query().Get("active") == "true"

	instances, err := h.instanceStore.List(activeOnly)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list instances")
		RespondError(w, http.StatusInternalServerError, "Failed to list instances")
		return
	}

	// Don't include encrypted passwords in response
	response := make([]map[string]interface{}, len(instances))
	for i, instance := range instances {
		response[i] = map[string]interface{}{
			"id":                instance.ID,
			"name":              instance.Name,
			"host":              instance.Host,
			"port":              instance.Port,
			"username":          instance.Username,
			"is_active":         instance.IsActive,
			"last_connected_at": instance.LastConnectedAt,
			"created_at":        instance.CreatedAt,
			"updated_at":        instance.UpdatedAt,
		}
	}

	RespondJSON(w, http.StatusOK, response)
}

// CreateInstance creates a new instance
func (h *InstancesHandler) CreateInstance(w http.ResponseWriter, r *http.Request) {
	var req CreateInstanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input
	if req.Name == "" || req.Host == "" || req.Port == 0 {
		RespondError(w, http.StatusBadRequest, "Name, host, and port are required")
		return
	}

	// Create instance
	instance, err := h.instanceStore.Create(req.Name, req.Host, req.Port, req.Username, req.Password)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create instance")
		RespondError(w, http.StatusInternalServerError, "Failed to create instance")
		return
	}

	// Test connection
	client, err := h.clientPool.GetClient(instance.ID)
	if err != nil {
		log.Warn().Err(err).Int("instanceID", instance.ID).Msg("Failed to connect to new instance")
		// Don't fail the creation, just warn
	} else {
		// Connection successful
		_ = client
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":                instance.ID,
		"name":              instance.Name,
		"host":              instance.Host,
		"port":              instance.Port,
		"username":          instance.Username,
		"is_active":         instance.IsActive,
		"last_connected_at": instance.LastConnectedAt,
		"created_at":        instance.CreatedAt,
		"updated_at":        instance.UpdatedAt,
	})
}

// UpdateInstance updates an existing instance
func (h *InstancesHandler) UpdateInstance(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	var req UpdateInstanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input
	if req.Name == "" || req.Host == "" || req.Port == 0 {
		RespondError(w, http.StatusBadRequest, "Name, host, and port are required")
		return
	}

	// Update instance
	instance, err := h.instanceStore.Update(instanceID, req.Name, req.Host, req.Port, req.Username, req.Password)
	if err != nil {
		if errors.Is(err, models.ErrInstanceNotFound) {
			RespondError(w, http.StatusNotFound, "Instance not found")
			return
		}
		log.Error().Err(err).Msg("Failed to update instance")
		RespondError(w, http.StatusInternalServerError, "Failed to update instance")
		return
	}

	// Remove old client from pool to force reconnection
	h.clientPool.RemoveClient(instanceID)

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":                instance.ID,
		"name":              instance.Name,
		"host":              instance.Host,
		"port":              instance.Port,
		"username":          instance.Username,
		"is_active":         instance.IsActive,
		"last_connected_at": instance.LastConnectedAt,
		"created_at":        instance.CreatedAt,
		"updated_at":        instance.UpdatedAt,
	})
}

// DeleteInstance deletes an instance
func (h *InstancesHandler) DeleteInstance(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Delete instance
	if err := h.instanceStore.Delete(instanceID); err != nil {
		if errors.Is(err, models.ErrInstanceNotFound) {
			RespondError(w, http.StatusNotFound, "Instance not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete instance")
		RespondError(w, http.StatusInternalServerError, "Failed to delete instance")
		return
	}

	// Remove client from pool
	h.clientPool.RemoveClient(instanceID)

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Instance deleted successfully",
	})
}

// TestConnection tests the connection to an instance
func (h *InstancesHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Try to get client (this will create connection if needed)
	client, err := h.clientPool.GetClient(instanceID)
	if err != nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{
			"connected": false,
			"error":     err.Error(),
		})
		return
	}

	// Perform health check
	if err := client.HealthCheck(r.Context()); err != nil {
		RespondJSON(w, http.StatusOK, map[string]interface{}{
			"connected": false,
			"error":     err.Error(),
		})
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"connected": true,
		"message":   "Connection successful",
	})
}

// GetInstanceStats returns statistics for an instance
func (h *InstancesHandler) GetInstanceStats(w http.ResponseWriter, r *http.Request) {
	// Get instance ID from URL
	instanceID, err := strconv.Atoi(chi.URLParam(r, "instanceID"))
	if err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	// Get client
	client, err := h.clientPool.GetClient(instanceID)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get client")
		RespondError(w, http.StatusInternalServerError, "Failed to connect to instance")
		return
	}

	// Get stats from qBittorrent
	// This is a simplified version - you can expand with more stats
	mainData, err := client.SyncMainDataCtx(r.Context(), 0)
	if err != nil {
		log.Error().Err(err).Int("instanceID", instanceID).Msg("Failed to get stats")
		RespondError(w, http.StatusInternalServerError, "Failed to get instance stats")
		return
	}

	stats := map[string]interface{}{
		"instance_id": instanceID,
		"connected":   client.IsHealthy(),
		"server_state": map[string]interface{}{
			"download_speed": mainData.ServerState.DlInfoSpeed,
			"upload_speed":   mainData.ServerState.UpInfoSpeed,
			"downloaded":     mainData.ServerState.DlInfoData,
			"uploaded":       mainData.ServerState.UpInfoData,
			"free_space":     mainData.ServerState.FreeSpaceOnDisk,
		},
		"torrents_count": len(mainData.Torrents),
	}

	RespondJSON(w, http.StatusOK, stats)
}