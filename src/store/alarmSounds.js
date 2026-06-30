// Web Audio API alarm sounds — no external files needed.
// Each exported play* function fires one audio cycle. Looping is handled externally.

let _ctx = null;

export function getAlarmAudioCtx() {
  const Cls = window.AudioContext || window.webkitAudioContext;
  if (!_ctx || _ctx.state === 'closed') _ctx = new Cls();
  return _ctx;
}

function tone(ctx, freq, startOffset, dur, vol, type = 'sine') {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.02);
}

/** Warm ascending bell — like a restaurant desk bell */
export function playClassicBell(ctx, volume = 0.7) {
  tone(ctx, 523, 0,    0.35, volume);
  tone(ctx, 659, 0.14, 0.35, volume * 0.85);
  tone(ctx, 784, 0.28, 0.55, volume);
}

/** Quick ascending chirp — Grab delivery app style */
export function playGrabStyle(ctx, volume = 0.7) {
  [440, 550, 660, 880].forEach((freq, i) => tone(ctx, freq, i * 0.1, 0.09, volume * 0.75));
}

/** Triple beep — LINE MAN notification style */
export function playLineManStyle(ctx, volume = 0.7) {
  [[880, 0], [880, 0.19], [1100, 0.38]].forEach(([freq, s]) => tone(ctx, freq, s, 0.11, volume * 0.7));
}

/** Urgent alternating alarm — kitchen emergency style */
export function playKitchenAlarm(ctx, volume = 0.7) {
  [880, 440, 880, 440, 880, 440].forEach((freq, i) =>
    tone(ctx, freq, i * 0.1, 0.08, volume * 0.6, 'square')
  );
}

export const SOUND_LABELS = {
  classic: 'Classic Bell',
  grab:    'Grab Style',
  lineman: 'LINE MAN Style',
  kitchen: 'Kitchen Alarm',
};

export const SOUND_KEYS = ['classic', 'grab', 'lineman', 'kitchen'];

export function playSound(type, ctx, volume) {
  switch (type) {
    case 'grab':    playGrabStyle(ctx, volume);    break;
    case 'lineman': playLineManStyle(ctx, volume); break;
    case 'kitchen': playKitchenAlarm(ctx, volume); break;
    default:        playClassicBell(ctx, volume);
  }
}

/** Compute effective volume respecting night-mode schedule */
export function getEffectiveVolume(settings) {
  const vol = (settings.volume ?? 80) / 100;
  const nm  = settings.nightMode;
  if (!nm?.enabled) return vol;
  const now  = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = (nm.startTime || '22:00').split(':').map(Number);
  const [eh, em] = (nm.endTime   || '07:00').split(':').map(Number);
  const startM = sh * 60 + sm, endM = eh * 60 + em;
  const isNight = startM > endM ? (nowM >= startM || nowM < endM) : (nowM >= startM && nowM < endM);
  return isNight ? (nm.volume ?? 30) / 100 : vol;
}
