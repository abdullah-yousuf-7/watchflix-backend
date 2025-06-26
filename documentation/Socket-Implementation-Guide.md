# WatchFlixx Socket.IO Implementation Guide

Complete implementation guide for real-time features using Socket.IO in the WatchFlixx platform.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Client Setup](#client-setup)
3. [Party Watch Implementation](#party-watch-implementation)
4. [Real-time Synchronization](#real-time-synchronization)
5. [Chat System](#chat-system)
6. [Connection Management](#connection-management)
7. [Error Handling](#error-handling)
8. [Performance Optimization](#performance-optimization)
9. [Testing](#testing)

## 🌐 Overview

The WatchFlixx platform uses Socket.IO for real-time features including:
- **Party Watch**: Synchronized video playback with friends
- **Live Chat**: Real-time messaging during watch parties
- **Notifications**: Instant notifications and updates
- **Presence**: User online/offline status
- **Content Updates**: Real-time content availability changes

### Architecture

```
Frontend (React) ↔ Socket.IO Client ↔ Socket.IO Server ↔ Redis (Event Bus) ↔ Microservices
```

## 🚀 Client Setup

### Installation

```bash
npm install socket.io-client
```

### Basic Connection

```typescript
// src/services/socket.ts
import { io, Socket } from 'socket.io-client';

interface SocketAuth {
  token: string;
  profileId: string;
  userId: string;
}

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(auth: SocketAuth): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(process.env.REACT_APP_SOCKET_URL || 'ws://localhost:3005', {
        auth: {
          token: auth.token,
          profileId: auth.profileId,
          userId: auth.userId
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: this.maxReconnectAttempts
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to WatchFlixx socket');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected:', reason);
        this.handleDisconnection(reason);
      });

      this.setupEventListeners();
    });
  }

  private handleDisconnection(reason: string) {
    if (reason === 'io server disconnect') {
      // Server initiated disconnect, don't reconnect automatically
      this.notifyDisconnection('Server disconnected');
    } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    } else {
      this.notifyDisconnection('Failed to reconnect after multiple attempts');
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('error', this.handleError.bind(this));
    this.socket.on('notification:new', this.handleNotification.bind(this));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket not connected, cannot emit event:', event);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  private handleError(error: any) {
    console.error('Socket error:', error);
    // Handle different error types
    switch (error.type) {
      case 'authentication':
        this.notifyAuthenticationError();
        break;
      case 'authorization':
        this.notifyAuthorizationError();
        break;
      default:
        this.notifyGenericError(error.message);
    }
  }

  private handleNotification(notification: any) {
    // Handle real-time notifications
    window.dispatchEvent(new CustomEvent('socket:notification', {
      detail: notification
    }));
  }

  private notifyDisconnection(reason: string) {
    window.dispatchEvent(new CustomEvent('socket:disconnected', {
      detail: { reason }
    }));
  }

  private notifyAuthenticationError() {
    window.dispatchEvent(new CustomEvent('socket:auth_error'));
  }

  private notifyAuthorizationError() {
    window.dispatchEvent(new CustomEvent('socket:auth_required'));
  }

  private notifyGenericError(message: string) {
    window.dispatchEvent(new CustomEvent('socket:error', {
      detail: { message }
    }));
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
```

### React Hook Integration

```typescript
// src/hooks/useSocket.ts
import { useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';
import { useAuth } from './useAuth';

export const useSocket = () => {
  const { user, token, currentProfile } = useAuth();
  const isConnecting = useRef(false);

  const connect = useCallback(async () => {
    if (!user || !token || !currentProfile || isConnecting.current) {
      return;
    }

    isConnecting.current = true;
    try {
      await socketService.connect({
        token,
        profileId: currentProfile.id,
        userId: user.id
      });
    } catch (error) {
      console.error('Failed to connect to socket:', error);
    } finally {
      isConnecting.current = false;
    }
  }, [user, token, currentProfile]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  useEffect(() => {
    if (user && token && currentProfile) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, token, currentProfile, connect, disconnect]);

  useEffect(() => {
    const handleDisconnection = (event: CustomEvent) => {
      console.log('Socket disconnected:', event.detail.reason);
      // Show user notification
    };

    const handleError = (event: CustomEvent) => {
      console.error('Socket error:', event.detail.message);
      // Show error notification
    };

    const handleAuthError = () => {
      console.log('Socket authentication failed, redirecting to login');
      // Redirect to login
    };

    window.addEventListener('socket:disconnected', handleDisconnection as EventListener);
    window.addEventListener('socket:error', handleError as EventListener);
    window.addEventListener('socket:auth_error', handleAuthError);

    return () => {
      window.removeEventListener('socket:disconnected', handleDisconnection as EventListener);
      window.removeEventListener('socket:error', handleError as EventListener);
      window.removeEventListener('socket:auth_error', handleAuthError);
    };
  }, []);

  return {
    isConnected: socketService.isConnected(),
    connect,
    disconnect,
    emit: socketService.emit.bind(socketService),
    on: socketService.on.bind(socketService),
    off: socketService.off.bind(socketService)
  };
};
```

## 🎭 Party Watch Implementation

### Party Watch Hook

```typescript
// src/hooks/usePartyWatch.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';

interface PartyMember {
  profileId: string;
  name: string;
  avatar: string;
  role: 'HOST' | 'MODERATOR' | 'MEMBER';
  joinedAt: string;
  isOnline: boolean;
}

interface PartyState {
  id: string;
  partyCode: string;
  inviteUrl: string;
  status: 'WAITING' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  host: PartyMember;
  members: PartyMember[];
  content: {
    id: string;
    title: string;
    posterUrl: string;
    type: 'MOVIE' | 'SERIES';
  };
  episode?: {
    id: string;
    title: string;
    seasonNumber: number;
    episodeNumber: number;
  };
  currentPosition: number;
  isPlaying: boolean;
  maxMembers: number;
}

interface ChatMessage {
  id: string;
  user: PartyMember;
  message: string;
  timestamp: number;
  videoTimestamp: number;
  createdAt: string;
}

interface EmojiReaction {
  id: string;
  user: PartyMember;
  emoji: string;
  position: { x: number; y: number };
  timestamp: number;
  videoTimestamp: number;
}

export const usePartyWatch = () => {
  const { emit, on, off, isConnected } = useSocket();
  const [party, setParty] = useState<PartyState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Interval>();

  // Create party
  const createParty = useCallback((contentId: string, episodeId?: string, maxMembers = 10) => {
    if (!isConnected) {
      throw new Error('Not connected to socket server');
    }

    emit('party:create', {
      contentId,
      episodeId,
      maxMembers,
      isPublic: false
    });
  }, [emit, isConnected]);

  // Join party
  const joinParty = useCallback((partyCode: string) => {
    if (!isConnected) {
      throw new Error('Not connected to socket server');
    }

    emit('party:join', { partyCode });
  }, [emit, isConnected]);

  // Leave party
  const leaveParty = useCallback(() => {
    if (party) {
      emit('party:leave');
      setParty(null);
      setMessages([]);
      setReactions([]);
      setIsHost(false);
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    }
  }, [emit, party]);

  // Start party (host only)
  const startParty = useCallback(() => {
    if (isHost) {
      emit('party:start');
    }
  }, [emit, isHost]);

  // Playback controls (host only)
  const playVideo = useCallback((timestamp: number) => {
    if (isHost) {
      emit('party:play', { timestamp });
    }
  }, [emit, isHost]);

  const pauseVideo = useCallback((timestamp: number) => {
    if (isHost) {
      emit('party:pause', { timestamp });
    }
  }, [emit, isHost]);

  const seekVideo = useCallback((timestamp: number, wasPlaying: boolean) => {
    if (isHost) {
      emit('party:seek', { timestamp, wasPlaying });
    }
  }, [emit, isHost]);

  // Request sync
  const requestSync = useCallback(() => {
    emit('party:sync_request');
  }, [emit]);

  // Send chat message
  const sendMessage = useCallback((message: string, videoTimestamp: number) => {
    if (party && message.trim()) {
      emit('party:message', {
        message: message.trim(),
        timestamp: videoTimestamp
      });
    }
  }, [emit, party]);

  // Send emoji reaction
  const sendReaction = useCallback((emoji: string, position: { x: number; y: number }, videoTimestamp: number) => {
    if (party) {
      emit('party:reaction', {
        emoji,
        position,
        timestamp: videoTimestamp
      });
    }
  }, [emit, party]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (party) {
      emit('party:typing', { isTyping });
    }
  }, [emit, party]);

  // Send heartbeat
  const sendHeartbeat = useCallback((timestamp: number, isPlaying: boolean, quality: string) => {
    if (party) {
      emit('party:heartbeat', {
        timestamp,
        isPlaying,
        quality
      });
    }
  }, [emit, party]);

  // Setup event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handlePartyCreated = (data: any) => {
      setParty(data.party);
      setIsHost(true);
      startHeartbeat();
    };

    const handlePartyJoined = (data: any) => {
      setParty(data.party);
      setIsHost(false);
      startHeartbeat();
    };

    const handleMemberJoined = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        members: [...prev.members, data.member]
      } : null);
    };

    const handleMemberLeft = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        members: prev.members.filter(m => m.profileId !== data.member.profileId)
      } : null);
    };

    const handlePartyStarted = () => {
      setParty(prev => prev ? { ...prev, status: 'ACTIVE' } : null);
    };

    const handlePartyEnded = () => {
      setParty(prev => prev ? { ...prev, status: 'ENDED' } : null);
      stopHeartbeat();
    };

    const handleHostChanged = (data: any) => {
      setParty(prev => prev ? { ...prev, host: data.newHost } : null);
      setIsHost(data.newHost.profileId === data.currentUserProfileId);
    };

    const handlePlay = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        currentPosition: data.timestamp,
        isPlaying: true
      } : null);
      
      // Trigger video play event for the video player
      window.dispatchEvent(new CustomEvent('party:video_play', {
        detail: { timestamp: data.timestamp }
      }));
    };

    const handlePause = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        currentPosition: data.timestamp,
        isPlaying: false
      } : null);
      
      // Trigger video pause event for the video player
      window.dispatchEvent(new CustomEvent('party:video_pause', {
        detail: { timestamp: data.timestamp }
      }));
    };

    const handleSeek = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        currentPosition: data.timestamp,
        isPlaying: data.wasPlaying
      } : null);
      
      // Trigger video seek event for the video player
      window.dispatchEvent(new CustomEvent('party:video_seek', {
        detail: { timestamp: data.timestamp, wasPlaying: data.wasPlaying }
      }));
    };

    const handleSync = (data: any) => {
      setParty(prev => prev ? {
        ...prev,
        currentPosition: data.timestamp,
        isPlaying: data.isPlaying
      } : null);
      
      // Trigger video sync event for the video player
      window.dispatchEvent(new CustomEvent('party:video_sync', {
        detail: { timestamp: data.timestamp, isPlaying: data.isPlaying }
      }));
    };

    const handleMessage = (data: any) => {
      const newMessage: ChatMessage = {
        id: data.id || Date.now().toString(),
        user: data.user,
        message: data.message,
        timestamp: data.timestamp,
        videoTimestamp: data.videoTimestamp,
        createdAt: data.createdAt
      };
      
      setMessages(prev => [...prev, newMessage]);
    };

    const handleReaction = (data: any) => {
      const newReaction: EmojiReaction = {
        id: data.id || Date.now().toString(),
        user: data.user,
        emoji: data.emoji,
        position: data.position,
        timestamp: data.timestamp,
        videoTimestamp: data.videoTimestamp
      };
      
      setReactions(prev => [...prev, newReaction]);
      
      // Remove reaction after 3 seconds
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      }, 3000);
    };

    const handleTyping = (data: any) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.user.profileId);
        } else {
          newSet.delete(data.user.profileId);
        }
        return newSet;
      });
      
      // Auto-remove typing indicator after 3 seconds
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.user.profileId);
            return newSet;
          });
        }, 3000);
      }
    };

    const handleConnectionQuality = (data: any) => {
      setConnectionQuality(data.quality);
    };

    const handlePartyError = (error: any) => {
      console.error('Party error:', error);
      window.dispatchEvent(new CustomEvent('party:error', {
        detail: { message: error.message }
      }));
    };

    // Register event listeners
    on('party:created', handlePartyCreated);
    on('party:joined', handlePartyJoined);
    on('party:member_joined', handleMemberJoined);
    on('party:member_left', handleMemberLeft);
    on('party:started', handlePartyStarted);
    on('party:ended', handlePartyEnded);
    on('party:host_changed', handleHostChanged);
    on('party:play', handlePlay);
    on('party:pause', handlePause);
    on('party:seek', handleSeek);
    on('party:sync', handleSync);
    on('party:message', handleMessage);
    on('party:reaction', handleReaction);
    on('party:typing', handleTyping);
    on('party:connection_quality', handleConnectionQuality);
    on('party:error', handlePartyError);

    return () => {
      // Cleanup event listeners
      off('party:created', handlePartyCreated);
      off('party:joined', handlePartyJoined);
      off('party:member_joined', handleMemberJoined);
      off('party:member_left', handleMemberLeft);
      off('party:started', handlePartyStarted);
      off('party:ended', handlePartyEnded);
      off('party:host_changed', handleHostChanged);
      off('party:play', handlePlay);
      off('party:pause', handlePause);
      off('party:seek', handleSeek);
      off('party:sync', handleSync);
      off('party:message', handleMessage);
      off('party:reaction', handleReaction);
      off('party:typing', handleTyping);
      off('party:connection_quality', handleConnectionQuality);
      off('party:error', handlePartyError);
    };
  }, [isConnected, on, off]);

  // Start heartbeat interval
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      // Get current video state from video player
      const videoElement = document.querySelector('video');
      if (videoElement && party) {
        sendHeartbeat(
          videoElement.currentTime,
          !videoElement.paused,
          'HD' // You can determine this based on current quality
        );
      }
    }, 5000); // Send heartbeat every 5 seconds
  }, [sendHeartbeat, party]);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [stopHeartbeat]);

  return {
    // State
    party,
    messages,
    reactions,
    isHost,
    connectionQuality,
    typingUsers: Array.from(typingUsers),
    
    // Actions
    createParty,
    joinParty,
    leaveParty,
    startParty,
    playVideo,
    pauseVideo,
    seekVideo,
    requestSync,
    sendMessage,
    sendReaction,
    sendTypingIndicator,
    
    // Utilities
    isInParty: !!party,
    isPartyActive: party?.status === 'ACTIVE',
    memberCount: party?.members.length || 0
  };
};
```

### Video Player Integration

```typescript
// src/components/VideoPlayer/PartyVideoPlayer.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { usePartyWatch } from '../../hooks/usePartyWatch';

interface PartyVideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: () => void;
}

export const PartyVideoPlayer: React.FC<PartyVideoPlayerProps> = ({
  src,
  poster,
  onTimeUpdate,
  onPlay,
  onPause,
  onSeeked
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isHost, isInParty, playVideo, pauseVideo, seekVideo, requestSync } = usePartyWatch();
  const lastSyncTime = useRef<number>(0);
  const isSeekingFromParty = useRef<boolean>(false);

  // Handle party video events
  useEffect(() => {
    if (!isInParty) return;

    const handlePartyPlay = (event: CustomEvent) => {
      const { timestamp } = event.detail;
      if (videoRef.current) {
        isSeekingFromParty.current = true;
        videoRef.current.currentTime = timestamp;
        videoRef.current.play();
        lastSyncTime.current = Date.now();
      }
    };

    const handlePartyPause = (event: CustomEvent) => {
      const { timestamp } = event.detail;
      if (videoRef.current) {
        isSeekingFromParty.current = true;
        videoRef.current.currentTime = timestamp;
        videoRef.current.pause();
        lastSyncTime.current = Date.now();
      }
    };

    const handlePartySeek = (event: CustomEvent) => {
      const { timestamp, wasPlaying } = event.detail;
      if (videoRef.current) {
        isSeekingFromParty.current = true;
        videoRef.current.currentTime = timestamp;
        if (wasPlaying) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
        lastSyncTime.current = Date.now();
      }
    };

    const handlePartySync = (event: CustomEvent) => {
      const { timestamp, isPlaying } = event.detail;
      if (videoRef.current) {
        const timeDiff = Math.abs(videoRef.current.currentTime - timestamp);
        
        // Only sync if the difference is significant (more than 1 second)
        if (timeDiff > 1) {
          isSeekingFromParty.current = true;
          videoRef.current.currentTime = timestamp;
        }
        
        if (isPlaying && videoRef.current.paused) {
          videoRef.current.play();
        } else if (!isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        
        lastSyncTime.current = Date.now();
      }
    };

    window.addEventListener('party:video_play', handlePartyPlay as EventListener);
    window.addEventListener('party:video_pause', handlePartyPause as EventListener);
    window.addEventListener('party:video_seek', handlePartySeek as EventListener);
    window.addEventListener('party:video_sync', handlePartySync as EventListener);

    return () => {
      window.removeEventListener('party:video_play', handlePartyPlay as EventListener);
      window.removeEventListener('party:video_pause', handlePartyPause as EventListener);
      window.removeEventListener('party:video_seek', handlePartySeek as EventListener);
      window.removeEventListener('party:video_sync', handlePartySync as EventListener);
    };
  }, [isInParty]);

  // Handle user interactions (only if host)
  const handlePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isInParty && isHost) {
      playVideo(videoRef.current.currentTime);
    }
    
    onPlay?.();
  }, [isHost, isInParty, playVideo, onPlay]);

  const handlePause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isInParty && isHost) {
      pauseVideo(videoRef.current.currentTime);
    }
    
    onPause?.();
  }, [isHost, isInParty, pauseVideo, onPause]);

  const handleSeeked = useCallback(() => {
    if (!videoRef.current || isSeekingFromParty.current) {
      isSeekingFromParty.current = false;
      return;
    }
    
    if (isInParty && isHost) {
      seekVideo(videoRef.current.currentTime, !videoRef.current.paused);
    }
    
    onSeeked?.();
  }, [isHost, isInParty, seekVideo, onSeeked]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    onTimeUpdate?.(videoRef.current.currentTime);
    
    // Request sync if we're out of sync (non-host members only)
    if (isInParty && !isHost) {
      const now = Date.now();
      if (now - lastSyncTime.current > 10000) { // Request sync every 10 seconds
        requestSync();
        lastSyncTime.current = now;
      }
    }
  }, [isInParty, isHost, requestSync, onTimeUpdate]);

  // Auto-sync when joining party
  useEffect(() => {
    if (isInParty && !isHost) {
      // Request initial sync when joining
      setTimeout(() => {
        requestSync();
      }, 1000);
    }
  }, [isInParty, isHost, requestSync]);

  return (
    <div className="party-video-player">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={!isInParty || isHost} // Only host can control in party mode
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000'
        }}
      />
      
      {isInParty && !isHost && (
        <div className="party-overlay">
          <div className="party-status">
            Watching with friends • Host controls playback
          </div>
        </div>
      )}
    </div>
  );
};
```

## 💬 Chat System Implementation

```typescript
// src/components/PartyWatch/PartyChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { usePartyWatch } from '../../hooks/usePartyWatch';

export const PartyChat: React.FC = () => {
  const {
    messages,
    typingUsers,
    sendMessage,
    sendReaction,
    sendTypingIndicator,
    party
  } = usePartyWatch();
  
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const videoTimeRef = useRef<number>(0);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update video time reference
  useEffect(() => {
    const updateVideoTime = () => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoTimeRef.current = videoElement.currentTime;
      }
    };

    const interval = setInterval(updateVideoTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessage(messageText, videoTimeRef.current);
      setMessageText('');
      handleStopTyping();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleEmojiReaction = (emoji: string, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const position = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
    
    sendReaction(emoji, position, videoTimeRef.current);
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!party) {
    return null;
  }

  return (
    <div className="party-chat">
      <div className="chat-header">
        <h3>Party Chat</h3>
        <span className="member-count">{party.members.length} members</span>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className="chat-message">
            <div className="message-header">
              <img 
                src={message.user.avatar} 
                alt={message.user.name}
                className="user-avatar"
              />
              <span className="user-name">{message.user.name}</span>
              <span className="message-time">
                {formatTimestamp(message.videoTimestamp)}
              </span>
            </div>
            <div className="message-content">{message.message}</div>
          </div>
        ))}
        
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.map(userId => {
              const user = party.members.find(m => m.profileId === userId);
              return user ? `${user.name} is typing...` : '';
            }).join(', ')}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <div className="emoji-reactions">
          {['😂', '😍', '😱', '👍', '👎', '🔥', '💯', '😭'].map(emoji => (
            <button
              key={emoji}
              className="emoji-button"
              onClick={(e) => handleEmojiReaction(emoji, e)}
            >
              {emoji}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSendMessage} className="chat-form">
          <input
            type="text"
            value={messageText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="chat-input"
            maxLength={500}
          />
          <button type="submit" className="send-button" disabled={!messageText.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
```

## 🔧 Error Handling & Recovery

```typescript
// src/utils/socketErrorHandler.ts
export class SocketErrorHandler {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 3;

  static handleError(error: any, context: string) {
    console.error(`Socket error in ${context}:`, error);
    
    switch (error.type) {
      case 'party_full':
        this.showError('This party is full. Please try joining another party.');
        break;
        
      case 'party_not_found':
        this.showError('Party not found. Please check the party code.');
        break;
        
      case 'content_access_denied':
        this.showError('You don\'t have access to this content.');
        break;
        
      case 'network_error':
        this.handleNetworkError(error, context);
        break;
        
      case 'authentication_error':
        this.handleAuthError();
        break;
        
      default:
        this.showError('An unexpected error occurred. Please try again.');
    }
  }

  private static handleNetworkError(error: any, context: string) {
    const attempts = this.retryAttempts.get(context) || 0;
    
    if (attempts < this.maxRetries) {
      this.retryAttempts.set(context, attempts + 1);
      setTimeout(() => {
        this.retryOperation(context);
      }, Math.pow(2, attempts) * 1000); // Exponential backoff
    } else {
      this.showError('Network error. Please check your connection and try again.');
      this.retryAttempts.delete(context);
    }
  }

  private static handleAuthError() {
    // Redirect to login
    window.location.href = '/login';
  }

  private static retryOperation(context: string) {
    // Emit retry event
    window.dispatchEvent(new CustomEvent('socket:retry', {
      detail: { context }
    }));
  }

  private static showError(message: string) {
    // Show error notification to user
    window.dispatchEvent(new CustomEvent('app:error', {
      detail: { message }
    }));
  }

  static clearRetries(context: string) {
    this.retryAttempts.delete(context);
  }
}
```

## 🚀 Performance Optimization

### Connection Pool Management

```typescript
// src/services/socketPool.ts
class SocketConnectionPool {
  private connections = new Map<string, Socket>();
  private maxConnections = 5;

  getConnection(namespace: string, auth: any): Socket {
    const key = `${namespace}-${auth.profileId}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    if (this.connections.size >= this.maxConnections) {
      this.cleanupOldestConnection();
    }

    const socket = io(namespace, { auth });
    this.connections.set(key, socket);
    
    return socket;
  }

  private cleanupOldestConnection() {
    const [oldestKey] = this.connections.keys();
    const oldestSocket = this.connections.get(oldestKey);
    
    if (oldestSocket) {
      oldestSocket.disconnect();
      this.connections.delete(oldestKey);
    }
  }

  cleanup() {
    this.connections.forEach(socket => socket.disconnect());
    this.connections.clear();
  }
}
```

### Event Throttling

```typescript
// src/utils/eventThrottling.ts
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

// Usage in party watch
const throttledHeartbeat = throttle(sendHeartbeat, 1000); // Max 1 heartbeat per second
```

## 🧪 Testing

### Socket Event Testing

```typescript
// src/__tests__/partyWatch.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePartyWatch } from '../hooks/usePartyWatch';
import { socketService } from '../services/socket';

// Mock socket service
jest.mock('../services/socket');

describe('usePartyWatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create party successfully', async () => {
    const { result } = renderHook(() => usePartyWatch());
    
    act(() => {
      result.current.createParty('content_123');
    });

    expect(socketService.emit).toHaveBeenCalledWith('party:create', {
      contentId: 'content_123',
      episodeId: undefined,
      maxMembers: 10,
      isPublic: false
    });
  });

  test('should handle party events correctly', () => {
    const { result } = renderHook(() => usePartyWatch());
    
    // Simulate party created event
    act(() => {
      window.dispatchEvent(new CustomEvent('party:created', {
        detail: {
          party: {
            id: 'party_123',
            partyCode: 'ABC123',
            status: 'WAITING'
          }
        }
      }));
    });

    expect(result.current.party?.id).toBe('party_123');
    expect(result.current.isHost).toBe(true);
  });
});
```

### Integration Testing

```typescript
// src/__tests__/integration/partyWatch.integration.test.ts
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket } from 'socket.io-client';

describe('Party Watch Integration', () => {
  let server: Server;
  let clientSocket: Socket;

  beforeAll((done) => {
    const httpServer = createServer();
    server = new Server(httpServer);
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`);
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
  });

  test('should handle party creation and joining', (done) => {
    let partyCode: string;

    // Host creates party
    clientSocket.emit('party:create', {
      contentId: 'content_123',
      maxMembers: 10
    });

    clientSocket.on('party:created', (data) => {
      partyCode = data.partyCode;
      expect(data.party.id).toBeDefined();
      
      // Second client joins
      const guestSocket = Client(`http://localhost:${(server as any).httpServer.address().port}`);
      
      guestSocket.on('connect', () => {
        guestSocket.emit('party:join', { partyCode });
      });

      guestSocket.on('party:joined', (joinData) => {
        expect(joinData.party.id).toBe(data.party.id);
        guestSocket.close();
        done();
      });
    });
  });
});
```

This comprehensive implementation guide covers all aspects of real-time Socket.IO integration for the WatchFlixx platform, including party watch functionality, chat systems, error handling, and performance optimization.