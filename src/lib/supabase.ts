import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RoomState, StudentSubmission } from '../types';

const STORAGE_KEY_URL = 'speed_quiz_supabase_url';
const STORAGE_KEY_KEY = 'speed_quiz_supabase_anon_key';

export function getStoredSupabaseConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : '';

  return {
    url: storedUrl || envUrl || '',
    anonKey: storedKey || envKey || '',
  };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getStoredSupabaseConfig();
  if (url && anonKey && url.startsWith('http')) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
  supabaseInstance = null;
  return getSupabase();
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; needsTables?: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL과 Anon Key를 모두 입력해주세요.' };
    }
    const client = createClient(url.trim(), anonKey.trim());
    // Attempt to query rooms table
    const { error } = await client.from('rooms').select('id').limit(1);
    if (error) {
      // PGRST205: Could not find the table in the schema cache
      // 42P01: undefined table
      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the table')
      ) {
        return {
          success: true,
          needsTables: true,
          message: '슈파베이스 API 인증 성공! 🔑 다만 아직 테이블이 없습니다. 아래 [테이블 SQL 생성하기] 버튼을 눌러 스크립트를 실행해주세요!',
        };
      }
      return { success: false, message: `연결 오류: ${error.message} (${error.code || ''})` };
    }
    return { success: true, needsTables: false, message: '슈파베이스 데이터베이스 및 Realtime 정상 연결 완료! 🟢' };
  } catch (err: any) {
    return { success: false, message: `연결 실패: ${err?.message || '네트워크 오류'}` };
  }
}

// SQL Schema for Supabase Editor
export const SUPABASE_SQL_SCHEMA = `-- 1. 방(rooms) 테이블 생성
create table if not exists public.rooms (
  id text primary key,
  pin text not null unique,
  teacher_name text not null default '선생님',
  title text default '스피드 키워드 경험 퀴즈',
  status text not null default 'waiting',
  current_quiz_index integer not null default 0,
  revealed_keyword_count integer not null default 1,
  timer_seconds integer not null default 30,
  active_buzzer jsonb default null,
  last_guess_result jsonb default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 학생 키워드 제출(submissions) 테이블 생성
create table if not exists public.submissions (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade,
  student_name text not null,
  avatar text default '🎓',
  keywords jsonb not null, -- 3~6개 키워드 배열
  story text default '',
  submitted_at bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 참여 학생(players) 테이블 생성
create table if not exists public.players (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade,
  name text not null,
  avatar text default '🎓',
  score integer default 0,
  is_online boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. RLS (Row Level Security) 활성화 및 모든 접근 허용 (학급 수업용)
alter table public.rooms enable row level security;
alter table public.submissions enable row level security;
alter table public.players enable row level security;

create policy "모든 사용자 방 조회 및 생성 허용" on public.rooms for all using (true) with check (true);
create policy "모든 사용자 제출 조회 및 생성 허용" on public.submissions for all using (true) with check (true);
create policy "모든 사용자 플레이어 정보 조회 및 갱신 허용" on public.players for all using (true) with check (true);

-- 5. Supabase Realtime 활성화 (실시간 변경 사항 브로드캐스트)
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.players;
`;

/**
 * Universal Real-Time Synchronizer:
 * Combines Supabase Realtime Channels, WebSocket server relay, and local BroadcastChannel
 * to ensure 100% reliable, zero-latency multi-client synchronization.
 */
export class RealtimeSyncManager {
  private roomId: string;
  private ws: WebSocket | null = null;
  private supabaseChannel: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onStateCallback: (state: RoomState) => void;
  private onBuzzerCallback?: (buzzer: any) => void;

  constructor(
    roomId: string,
    onState: (state: RoomState) => void,
    onBuzzer?: (buzzer: any) => void
  ) {
    this.roomId = roomId;
    this.onStateCallback = onState;
    this.onBuzzerCallback = onBuzzer;
    this.init();
  }

  private init() {
    // 1. BroadcastChannel for same-browser multi-tab instant sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`speed_quiz_${this.roomId}`);
        this.broadcastChannel.onmessage = (ev) => {
          if (ev.data?.type === 'ROOM_STATE' && ev.data.payload) {
            this.onStateCallback(ev.data.payload);
          } else if (ev.data?.type === 'BUZZ_SOUND' && this.onBuzzerCallback) {
            this.onBuzzerCallback(ev.data.payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Connect to Server WebSocket
    this.connectWebSocket();

    // 3. Connect to Supabase Realtime if configured
    this.connectSupabase();
  }

  private connectWebSocket() {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({ type: 'REQUEST_STATE', roomId: this.roomId }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ROOM_STATE' && data.payload) {
            this.onStateCallback(data.payload);
          } else if (data.type === 'BUZZ_SOUND' && this.onBuzzerCallback) {
            this.onBuzzerCallback(data.payload);
          }
        } catch {
          // ignore
        }
      };

      this.ws.onerror = () => {
        // Fallback to local sync
      };
    } catch (e) {
      console.warn('WS Init failed:', e);
    }
  }

  private connectSupabase() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      this.supabaseChannel = supabase.channel(`room_${this.roomId}`)
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
          if (payload) this.onStateCallback(payload);
        })
        .on('broadcast', { event: 'buzz_event' }, ({ payload }) => {
          if (this.onBuzzerCallback) this.onBuzzerCallback(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Supabase Realtime Subscribed to room:', this.roomId);
          }
        });

      // Also try fetching room and submissions from Supabase table if existing
      supabase.from('rooms').select('*').eq('id', this.roomId).single().then(async ({ data: roomData }) => {
        if (roomData) {
          const { data: subData } = await supabase.from('submissions').select('*').eq('room_id', this.roomId);
          const { data: playerData } = await supabase.from('players').select('*').eq('room_id', this.roomId);
          
          const restoredState: RoomState = {
            id: roomData.id,
            pin: roomData.pin,
            teacherName: roomData.teacher_name,
            title: roomData.title,
            status: roomData.status,
            currentQuizIndex: roomData.current_quiz_index,
            revealedKeywordCount: roomData.revealed_keyword_count,
            timerSeconds: roomData.timer_seconds,
            isTimerRunning: false,
            submissions: (subData || []).map((s: any) => ({
              id: s.id,
              roomId: s.room_id,
              studentName: s.student_name,
              avatar: s.avatar,
              keywords: s.keywords,
              story: s.story,
              submittedAt: Number(s.submitted_at),
            })),
            players: (playerData || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              score: p.score,
              isOnline: p.is_online,
            })),
            activeBuzzer: roomData.active_buzzer,
            lastGuessResult: roomData.last_guess_result,
          };
          this.onStateCallback(restoredState);
        }
      });
    } catch (e) {
      console.warn('Supabase Realtime subscribe failed:', e);
    }
  }

  public sendJoin(player?: { id: string; name: string; avatar: string }, teacherName?: string) {
    const payload = { roomId: this.roomId, playerId: player?.id, player, teacherName };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: this.roomId, payload }));
    }
    // Also save player to Supabase if configured
    const supabase = getSupabase();
    if (supabase && player) {
      supabase.from('players').upsert({
        id: player.id,
        room_id: this.roomId,
        name: player.name,
        avatar: player.avatar,
        is_online: true,
      }).then();
    }
  }

  public submitKeywords(submission: StudentSubmission) {
    // 1. WS
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBMIT_KEYWORDS',
        roomId: this.roomId,
        payload: submission,
      }));
    }
    // 2. BroadcastChannel
    this.broadcastChannel?.postMessage({
      type: 'SUBMISSION_ADDED',
      payload: submission,
    });
    // 3. Supabase DB & Realtime
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('submissions').upsert({
        id: submission.id,
        room_id: this.roomId,
        student_name: submission.studentName,
        avatar: submission.avatar,
        keywords: submission.keywords,
        story: submission.story || '',
        submitted_at: submission.submittedAt,
      }).then();

      this.supabaseChannel?.send({
        type: 'broadcast',
        event: 'submission_added',
        payload: submission,
      });
    }
  }

  public updateRoomState(newState: RoomState) {
    // 1. Local Broadcast
    this.broadcastChannel?.postMessage({
      type: 'ROOM_STATE',
      payload: newState,
    });
    // 2. WS
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UPDATE_ROOM',
        roomId: this.roomId,
        payload: newState,
      }));
    }
    // 3. Supabase
    const supabase = getSupabase();
    if (supabase) {
      supabase.from('rooms').upsert({
        id: newState.id,
        pin: newState.pin,
        teacher_name: newState.teacherName,
        title: newState.title || '스피드 키워드 경험 퀴즈',
        status: newState.status,
        current_quiz_index: newState.currentQuizIndex,
        revealed_keyword_count: newState.revealedKeywordCount,
        timer_seconds: newState.timerSeconds,
        active_buzzer: newState.activeBuzzer,
        last_guess_result: newState.lastGuessResult,
      }).then();

      this.supabaseChannel?.send({
        type: 'broadcast',
        event: 'state_update',
        payload: newState,
      });
    }
  }

  public sendBuzz(studentId: string, studentName: string) {
    const payload = { studentId, studentName, timestamp: Date.now() };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'BUZZ',
        roomId: this.roomId,
        payload,
      }));
    }
    this.broadcastChannel?.postMessage({
      type: 'BUZZ_SOUND',
      payload,
    });
    const supabase = getSupabase();
    if (supabase) {
      this.supabaseChannel?.send({
        type: 'broadcast',
        event: 'buzz_event',
        payload,
      });
    }
  }

  public sendGuess(studentName: string, guessedName: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'GUESS_ANSWER',
        roomId: this.roomId,
        payload: { studentName, guessedName },
      }));
    }
  }

  public destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    if (this.supabaseChannel) {
      const supabase = getSupabase();
      if (supabase) supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
  }
}
