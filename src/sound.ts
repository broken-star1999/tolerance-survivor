export type SoundMode = 'menu' | 'run' | 'boss' | 'quiet';

export type SoundEffect =
  | 'start' | 'strike' | 'hit' | 'hurt' | 'dash' | 'pick' | 'level'
  | 'accept' | 'clear' | 'boss' | 'wave' | 'success' | 'fail' | 'click';

interface Tone {
  frequency: number;
  duration: number;
  volume: number;
  shape?: OscillatorType;
  delay?: number;
  attack?: number;
  endFrequency?: number;
  cutoff?: number;
}

interface Noise {
  frequency: number;
  duration: number;
  volume: number;
  delay?: number;
  highpass?: boolean;
}

interface Cue {
  cooldown: number;
  tones?: readonly Tone[];
  noise?: readonly Noise[];
}

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  music: GainNode;
  effects: GainNode;
  noise: AudioBuffer;
}

const CUES: Record<SoundEffect, Cue> = {
  start: {
    cooldown: 0.48,
    tones: [
      { frequency: 185, duration: 0.14, volume: 0.18, shape: 'triangle' },
      { frequency: 277, duration: 0.13, volume: 0.14, shape: 'square', cutoff: 1600, delay: 0.09 },
      { frequency: 370, duration: 0.22, volume: 0.15, shape: 'triangle', delay: 0.17 },
    ],
  },
  strike: {
    cooldown: 0.115,
    tones: [{ frequency: 910, endFrequency: 280, duration: 0.07, volume: 0.075, shape: 'triangle' }],
    noise: [{ frequency: 1900, duration: 0.042, volume: 0.055 }],
  },
  hit: {
    cooldown: 0.087,
    tones: [{ frequency: 160, endFrequency: 75, duration: 0.067, volume: 0.10, shape: 'triangle' }],
    noise: [{ frequency: 860, duration: 0.037, volume: 0.048 }],
  },
  hurt: {
    cooldown: 0.26,
    tones: [
      { frequency: 220, endFrequency: 98, duration: 0.19, volume: 0.18, shape: 'sawtooth', cutoff: 690 },
      { frequency: 98, endFrequency: 69, duration: 0.16, volume: 0.13, delay: 0.04 },
    ],
    noise: [{ frequency: 610, duration: 0.13, volume: 0.10 }],
  },
  dash: {
    cooldown: 0.18,
    tones: [{ frequency: 180, endFrequency: 720, duration: 0.15, volume: 0.08, shape: 'triangle' }],
    noise: [{ frequency: 1370, duration: 0.16, volume: 0.12, highpass: true }],
  },
  pick: {
    cooldown: 0.085,
    tones: [
      { frequency: 554, duration: 0.07, volume: 0.075, shape: 'triangle' },
      { frequency: 831, duration: 0.085, volume: 0.063, shape: 'triangle', delay: 0.04 },
    ],
  },
  level: {
    cooldown: 0.34,
    tones: [
      { frequency: 370, duration: 0.14, volume: 0.14, shape: 'triangle' },
      { frequency: 554, duration: 0.16, volume: 0.12, shape: 'triangle', delay: 0.065 },
      { frequency: 659, duration: 0.20, volume: 0.11, shape: 'triangle', delay: 0.13 },
      { frequency: 740, duration: 0.26, volume: 0.15, shape: 'triangle', delay: 0.19 },
    ],
  },
  accept: {
    cooldown: 0.36,
    tones: [
      { frequency: 415, duration: 0.14, volume: 0.12, shape: 'triangle' },
      { frequency: 523, duration: 0.17, volume: 0.12, shape: 'triangle', delay: 0.08 },
      { frequency: 131, endFrequency: 92, duration: 0.24, volume: 0.12, shape: 'square', cutoff: 480, delay: 0.18 },
    ],
  },
  clear: {
    cooldown: 0.42,
    tones: [
      { frequency: 124, endFrequency: 46, duration: 0.31, volume: 0.24, shape: 'triangle' },
      { frequency: 740, endFrequency: 185, duration: 0.24, volume: 0.1, shape: 'triangle', delay: 0.06 },
    ],
    noise: [{ frequency: 620, duration: 0.29, volume: 0.16 }],
  },
  boss: {
    cooldown: 0.7,
    tones: [
      { frequency: 102, endFrequency: 47, duration: 0.54, volume: 0.25, shape: 'triangle' },
      { frequency: 226, duration: 0.24, volume: 0.13, shape: 'sawtooth', cutoff: 1100, delay: 0.08 },
      { frequency: 196, duration: 0.29, volume: 0.15, shape: 'sawtooth', cutoff: 840, delay: 0.30 },
    ],
    noise: [{ frequency: 340, duration: 0.38, volume: 0.14 }],
  },
  wave: {
    cooldown: 0.24,
    tones: [
      { frequency: 247, endFrequency: 370, duration: 0.16, volume: 0.13, shape: 'triangle' },
      { frequency: 95, endFrequency: 51, duration: 0.23, volume: 0.16, shape: 'triangle', delay: 0.11 },
    ],
    noise: [{ frequency: 1150, duration: 0.13, volume: 0.07, delay: 0.08 }],
  },
  success: {
    cooldown: 0.85,
    tones: [
      { frequency: 185, duration: 0.58, volume: 0.15, shape: 'triangle' },
      { frequency: 370, duration: 0.25, volume: 0.12, shape: 'triangle' },
      { frequency: 554, duration: 0.25, volume: 0.12, shape: 'triangle', delay: 0.09 },
      { frequency: 659, duration: 0.32, volume: 0.11, shape: 'triangle', delay: 0.19 },
      { frequency: 740, duration: 0.52, volume: 0.15, shape: 'triangle', delay: 0.31 },
    ],
  },
  fail: {
    cooldown: 0.85,
    tones: [
      { frequency: 233, duration: 0.21, volume: 0.16, shape: 'triangle' },
      { frequency: 185, duration: 0.27, volume: 0.15, shape: 'triangle', delay: 0.16 },
      { frequency: 110, endFrequency: 78, duration: 0.43, volume: 0.16, shape: 'sawtooth', cutoff: 550, delay: 0.32 },
    ],
  },
  click: {
    cooldown: 0.095,
    tones: [{ frequency: 610, endFrequency: 445, duration: 0.052, volume: 0.078, shape: 'triangle' }],
  },
};

const TEMPOS = { menu: 82, run: 106, boss: 137 };
const MUSIC_MIX = { menu: 0.40, run: 0.50, boss: 0.57, quiet: 0 };
const CHORDS = [
  { root: 42, pad: [54, 57, 61, 68] },
  { root: 38, pad: [54, 57, 61, 64] },
  { root: 35, pad: [54, 57, 59, 66] },
  { root: 40, pad: [56, 59, 61, 66] },
];
const MELODY_STEPS = [2, 5, 9, 12, 15];
const MELODY_INTERVALS = [0, 1, -1, 2, 0];
const BASS_STEPS = [0, 3, 6, 8, 10, 13];
const FLOOR = 0.0001;
const EFFECT_CAPACITY = 5;
const EFFECT_REFILL = 12;

function midi(note: number): number {
  return 440 * (2 ** ((note - 69) / 12));
}

function envelope(node: GainNode, at: number, attack: number, end: number, volume: number): void {
  node.gain.setValueAtTime(FLOOR, at);
  node.gain.exponentialRampToValueAtTime(volume, at + attack);
  node.gain.exponentialRampToValueAtTime(FLOOR, end);
}

function tone(context: AudioContext, output: AudioNode, at: number, spec: Tone): void {
  const start = at + (spec.delay ?? 0);
  const end = start + spec.duration;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = spec.shape ?? 'sine';
  oscillator.frequency.setValueAtTime(spec.frequency, start);
  if (spec.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(spec.endFrequency, end);
  envelope(gain, start, spec.attack ?? 0.009, end, spec.volume);
  oscillator.connect(gain);

  if (spec.cutoff) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff;
    gain.connect(filter).connect(output);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); filter.disconnect(); };
  } else {
    gain.connect(output);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  oscillator.start(start);
  oscillator.stop(end + 0.008);
}

function noise(graph: AudioGraph, output: AudioNode, at: number, spec: Noise): void {
  const start = at + (spec.delay ?? 0);
  const end = start + spec.duration;
  const source = graph.context.createBufferSource();
  const filter = graph.context.createBiquadFilter();
  const gain = graph.context.createGain();
  source.buffer = graph.noise;
  filter.type = spec.highpass ? 'highpass' : 'bandpass';
  filter.frequency.value = spec.frequency;
  filter.Q.value = 0.82;
  envelope(gain, start, 0.007, end, spec.volume);
  source.connect(filter).connect(gain).connect(output);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start(start);
  source.stop(end + 0.008);
}

function createGraph(context: AudioContext): AudioGraph {
  const master = context.createGain();
  const music = context.createGain();
  const effects = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
  const samples = noise.getChannelData(0);
  let seed = 0x35ae95d1;
  for (let index = 0; index < samples.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[index] = seed / 2147483648 - 1;
  }

  master.gain.value = 0;
  music.gain.value = 0;
  effects.gain.value = 0.83;
  limiter.threshold.value = -11;
  limiter.knee.value = 11;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.008;
  limiter.release.value = 0.18;
  music.connect(master);
  effects.connect(master);
  master.connect(limiter).connect(context.destination);
  return { context, master, music, effects, noise };
}

function musicBeat(graph: AudioGraph, mode: Exclude<SoundMode, 'quiet'>, step: number, at: number): void {
  const { context, music } = graph;
  const beat = step % 16;
  const chord = CHORDS[Math.floor(step / 16) % CHORDS.length]!;
  const spacing = 30 / TEMPOS[mode];
  const urgent = mode === 'boss';

  if (beat === 0 || (beat === 8 && mode === 'menu')) {
    for (const note of chord.pad.slice(0, 3)) {
      tone(context, music, at, {
        frequency: midi(note),
        duration: spacing * (urgent ? 3.5 : 7.6),
        volume: urgent ? 0.034 : 0.055,
        shape: 'triangle',
        attack: urgent ? 0.07 : 0.19,
        cutoff: 900,
      });
    }
  }

  const melodyIndex = MELODY_STEPS.indexOf(beat);
  if (melodyIndex >= 0 && (!urgent || beat !== 5)) {
    const index = (melodyIndex + Math.floor(step / 16)) % chord.pad.length;
    const note = chord.pad[index]! + 12 + MELODY_INTERVALS[melodyIndex]!;
    tone(context, music, at, {
      frequency: midi(note),
      duration: spacing * (mode === 'menu' ? 1.9 : 0.9),
      volume: urgent ? 0.071 : 0.085,
      shape: urgent ? 'square' : 'triangle',
      cutoff: urgent ? 1650 : 2200,
    });
  }

  const bass = mode === 'menu' ? beat === 0 || beat === 10 : urgent || BASS_STEPS.includes(beat);
  if (bass) {
    const interval = beat === 3 || beat === 10 ? 7 : beat === 6 || beat === 15 ? 12 : 0;
    tone(context, music, at, {
      frequency: midi(chord.root + interval),
      duration: spacing * (mode === 'menu' ? 4 : urgent ? 0.7 : 1.4),
      volume: urgent ? 0.21 : 0.15,
      shape: urgent ? 'sawtooth' : 'triangle',
      cutoff: urgent ? 500 : 750,
    });
  }

  if (mode === 'menu') return;
  if (beat === 0 || beat === 8 || beat === 11 || (urgent && beat === 6)) {
    tone(context, music, at, {
      frequency: urgent ? 126 : 100, endFrequency: 44, duration: 0.145,
      volume: urgent ? 0.27 : 0.19, shape: 'triangle',
    });
  }
  if (beat === 4 || beat === 12) {
    noise(graph, music, at, {
      frequency: urgent ? 1420 : 1060,
      duration: urgent ? 0.14 : 0.105,
      volume: urgent ? 0.13 : 0.085,
    });
  }
  if (beat % 2 === 1) {
    noise(graph, music, at, {
      frequency: 6300, duration: urgent ? 0.055 : 0.039,
      volume: urgent ? 0.041 : 0.029, highpass: true,
    });
  }
}

export function createSound(): {
  unlock(): void;
  setEnabled(value: boolean): void;
  setMode(mode: SoundMode): void;
  play(effect: SoundEffect): void;
} {
  let graph: AudioGraph | undefined;
  let unavailable = false;
  let enabled = true;
  let mode: SoundMode = 'menu';
  let timer: number | undefined;
  let nextBeat = 0;
  let beat = 0;
  let resuming = false;
  let pendingCue: SoundEffect | undefined;
  let effectCredits = EFFECT_CAPACITY;
  let lastRefill = 0;
  const lastCue: Partial<Record<SoundEffect, number>> = {};

  function scheduleMusic(): void {
    if (!graph || mode === 'quiet' || graph.context.state !== 'running') return;
    const now = graph.context.currentTime;
    if (nextBeat < now - 0.08) nextBeat = now + 0.04;
    while (nextBeat < now + 0.13) {
      musicBeat(graph, mode, beat, Math.max(nextBeat, now + 0.003));
      nextBeat += 30 / TEMPOS[mode];
      beat++;
    }
  }

  function syncMix(): void {
    if (!graph) return;
    const audible = enabled && !document.hidden;
    const now = graph.context.currentTime;
    graph.master.gain.setTargetAtTime(audible ? 0.88 : 0, now, 0.018);
    graph.music.gain.setTargetAtTime(audible ? MUSIC_MIX[mode] : 0, now, 0.04);
    const shouldSchedule = audible && mode !== 'quiet' && graph.context.state === 'running';
    if (shouldSchedule && timer === undefined) {
      nextBeat = now + 0.045;
      timer = window.setInterval(scheduleMusic, 35);
      scheduleMusic();
    } else if (!shouldSchedule && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  function play(effect: SoundEffect): void {
    if (!graph || !enabled || document.hidden) return;
    if (graph.context.state !== 'running') {
      if (resuming) pendingCue = effect;
      return;
    }

    const cue = CUES[effect];
    const now = graph.context.currentTime;
    if (now - (lastCue[effect] ?? -Infinity) < cue.cooldown) return;
    effectCredits = Math.min(EFFECT_CAPACITY, effectCredits + (now - lastRefill) * EFFECT_REFILL);
    lastRefill = now;
    if (effectCredits < 1) return;
    effectCredits--;
    lastCue[effect] = now;

    const start = now + 0.006;
    for (const part of cue.tones ?? []) tone(graph.context, graph.effects, start, part);
    for (const part of cue.noise ?? []) noise(graph, graph.effects, start, part);
  }

  function unlock(): void {
    if (unavailable || typeof window === 'undefined') return;
    if (!graph) {
      const legacy = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Audio = window.AudioContext ?? legacy.webkitAudioContext;
      if (!Audio) {
        unavailable = true;
        return;
      }
      try {
        graph = createGraph(new Audio());
      } catch {
        unavailable = true;
        return;
      }
      graph.context.addEventListener('statechange', syncMix);
      document.addEventListener('visibilitychange', syncMix);
    }

    if (graph.context.state === 'running') {
      syncMix();
      return;
    }

    if (!resuming && graph.context.state !== 'closed') {
      resuming = true;
      void graph.context.resume().then(() => {
        syncMix();
        if (pendingCue) play(pendingCue);
      }).catch(() => {
        pendingCue = undefined;
      }).finally(() => {
        resuming = false;
        pendingCue = undefined;
      });
    }
  }

  return {
    unlock,
    play,
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      syncMix();
    },
    setMode(value) {
      if (mode === value) return;
      mode = value;
      syncMix();
    },
  };
}
