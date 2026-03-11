// =============================================================================
// PM2 Ecosystem Configuration — RDSWA Server
// =============================================================================

module.exports = {
  apps: [
    {
      name: "rdswa-server",
      script: "server/dist/app.js",
      instances: "max",
      exec_mode: "cluster",

      // Environment
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/error.log",
      out_file: "logs/output.log",
      merge_logs: true,
      log_type: "json",

      // Process management
      max_memory_restart: "512M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Watch (disabled in production — use for staging if needed)
      watch: false,
      ignore_watch: ["node_modules", "logs", "uploads", ".git"],

      // Source maps for error traces
      source_map_support: true,
    },
  ],
};
