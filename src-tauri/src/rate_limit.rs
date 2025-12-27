//! Rate Limiter for EnvSync
//!
//! Implements rate limiting to protect against brute force attacks
//! on sensitive operations like vault unlock.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Configuration for rate limiting
#[derive(Clone)]
pub struct RateLimitConfig {
    /// Maximum number of failed attempts before lockout
    pub max_attempts: u32,
    /// Duration of lockout after max attempts exceeded
    pub lockout_duration: Duration,
    /// Time window for counting attempts
    pub window_duration: Duration,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            lockout_duration: Duration::from_secs(300), // 5 minutes
            window_duration: Duration::from_secs(60),   // 1 minute
        }
    }
}

/// Tracks rate limiting state for a single key
struct RateLimitState {
    attempts: Vec<Instant>,
    locked_until: Option<Instant>,
}

impl RateLimitState {
    fn new() -> Self {
        Self {
            attempts: Vec::new(),
            locked_until: None,
        }
    }

    /// Check if currently locked out
    fn is_locked(&self) -> bool {
        if let Some(until) = self.locked_until {
            Instant::now() < until
        } else {
            false
        }
    }

    /// Get remaining lockout duration in seconds
    fn lockout_remaining(&self) -> Option<u64> {
        if let Some(until) = self.locked_until {
            let now = Instant::now();
            if now < until {
                Some((until - now).as_secs())
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Count attempts within the time window
    fn count_recent_attempts(&self, window: Duration) -> u32 {
        let cutoff = Instant::now() - window;
        self.attempts.iter().filter(|t| **t > cutoff).count() as u32
    }

    /// Record a new attempt
    fn record_attempt(&mut self) {
        self.attempts.push(Instant::now());
        // Clean up old attempts
        let cutoff = Instant::now() - Duration::from_secs(3600); // Keep 1 hour
        self.attempts.retain(|t| *t > cutoff);
    }

    /// Set lockout
    fn set_lockout(&mut self, duration: Duration) {
        self.locked_until = Some(Instant::now() + duration);
    }

    /// Clear lockout (on successful auth)
    fn clear(&mut self) {
        self.attempts.clear();
        self.locked_until = None;
    }
}

/// Rate limiter for protecting against brute force attacks
pub struct RateLimiter {
    config: RateLimitConfig,
    states: Mutex<HashMap<String, RateLimitState>>,
}

impl RateLimiter {
    /// Create a new rate limiter with default config
    pub fn new() -> Self {
        Self::with_config(RateLimitConfig::default())
    }

    /// Create a new rate limiter with custom config
    pub fn with_config(config: RateLimitConfig) -> Self {
        Self {
            config,
            states: Mutex::new(HashMap::new()),
        }
    }

    /// Check if an operation should be allowed
    /// Returns Ok(()) if allowed, Err with remaining lockout seconds if blocked
    pub fn check(&self, key: &str) -> Result<(), u64> {
        let mut states = self.states.lock().unwrap();
        let state = states.entry(key.to_string()).or_insert_with(RateLimitState::new);

        // Check if locked out
        if let Some(remaining) = state.lockout_remaining() {
            return Err(remaining);
        }

        // Clear expired lockout
        if state.locked_until.is_some() && !state.is_locked() {
            state.locked_until = None;
        }

        Ok(())
    }

    /// Record a failed attempt
    /// Returns Err with lockout seconds if this triggers a lockout
    pub fn record_failure(&self, key: &str) -> Result<(), u64> {
        let mut states = self.states.lock().unwrap();
        let state = states.entry(key.to_string()).or_insert_with(RateLimitState::new);

        state.record_attempt();

        // Check if we should lock out
        let recent_attempts = state.count_recent_attempts(self.config.window_duration);
        if recent_attempts >= self.config.max_attempts {
            // Apply exponential backoff: 5min, 10min, 20min, 40min, etc.
            let multiplier = (recent_attempts - self.config.max_attempts + 1) as u32;
            let lockout = self.config.lockout_duration * multiplier.min(8); // Cap at 40 min
            state.set_lockout(lockout);
            return Err(lockout.as_secs());
        }

        Ok(())
    }

    /// Record a successful operation (clears attempts)
    pub fn record_success(&self, key: &str) {
        let mut states = self.states.lock().unwrap();
        if let Some(state) = states.get_mut(key) {
            state.clear();
        }
    }

    /// Get remaining attempts before lockout
    pub fn remaining_attempts(&self, key: &str) -> u32 {
        let states = self.states.lock().unwrap();
        if let Some(state) = states.get(key) {
            let recent = state.count_recent_attempts(self.config.window_duration);
            self.config.max_attempts.saturating_sub(recent)
        } else {
            self.config.max_attempts
        }
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_initial_attempt() {
        let limiter = RateLimiter::new();
        assert!(limiter.check("test").is_ok());
    }

    #[test]
    fn test_allows_under_limit() {
        let limiter = RateLimiter::new();
        for _ in 0..4 {
            limiter.record_failure("test").ok();
        }
        assert!(limiter.check("test").is_ok());
    }

    #[test]
    fn test_blocks_after_limit() {
        let limiter = RateLimiter::new();
        for _ in 0..5 {
            limiter.record_failure("test").ok();
        }
        assert!(limiter.check("test").is_err());
    }

    #[test]
    fn test_success_clears_attempts() {
        let limiter = RateLimiter::new();
        for _ in 0..4 {
            limiter.record_failure("test").ok();
        }
        limiter.record_success("test");
        assert_eq!(limiter.remaining_attempts("test"), 5);
    }

    #[test]
    fn test_different_keys_independent() {
        let limiter = RateLimiter::new();
        for _ in 0..5 {
            limiter.record_failure("key1").ok();
        }
        assert!(limiter.check("key1").is_err());
        assert!(limiter.check("key2").is_ok());
    }
}
