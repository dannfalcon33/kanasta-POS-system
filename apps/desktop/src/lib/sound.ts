/**
 * Kanasta POS Sound Engine
 * Synthesizes the authentic mechanical cash register "Ka-Ching!" sound
 * with zero network latency, 100% offline, powered by Web Audio API.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Read persisted sound preference if available
    try {
      const stored = localStorage.getItem('kanasta_sound_enabled');
      if (stored !== null) {
        this.soundEnabled = stored === 'true';
      }
    } catch {
      this.soundEnabled = true;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch (e) {
      console.warn('AudioContext no inicializado:', e);
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem('kanasta_sound_enabled', String(this.soundEnabled));
    } catch {
      // Ignorar restricciones de storage
    }
    if (this.soundEnabled) {
      // Breve beep de confirmación
      this.playConfirmChime();
    }
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('kanasta_sound_enabled', String(enabled));
    } catch {
      // Ignorar restricciones
    }
  }

  private playConfirmChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now); // C6
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Reproduce el clásico y nítido sonido de caja registradora ("¡Cachin!").
   * Compuesto por:
   * 1. Golpe mecánico del pestillo del cajón ("Ka-")
   * 2. Campana de bronce brillante resonante ("-CHING!")
   * 3. Sonido metálico de monedas cayendo en la bandeja
   */
  public playCashRegisterSound(): void {
    if (!this.soundEnabled) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // --- 1. Golpe mecánico del cajón abriéndose ("Ka-") ---
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(160, now);
    latchOsc.frequency.exponentialRampToValueAtTime(45, now + 0.05);

    latchGain.gain.setValueAtTime(0.35, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.05);

    // --- 2. Campana metálica de latón resonante ("-CHING!") ---
    const chimeStart = now + 0.045;

    // Tono fundamental (agudo y brillante) ~1975.5 Hz (B6)
    const bell1 = ctx.createOscillator();
    const bellGain1 = ctx.createGain();
    bell1.type = 'sine';
    bell1.frequency.setValueAtTime(1975.53, chimeStart);
    bellGain1.gain.setValueAtTime(0.001, now);
    bellGain1.gain.setValueAtTime(0.55, chimeStart);
    bellGain1.gain.exponentialRampToValueAtTime(0.0001, chimeStart + 1.35);

    bell1.connect(bellGain1);
    bellGain1.connect(ctx.destination);
    bell1.start(chimeStart);
    bell1.stop(chimeStart + 1.35);

    // Armónico campana metálica ~3951 Hz (B7)
    const bell2 = ctx.createOscillator();
    const bellGain2 = ctx.createGain();
    bell2.type = 'sine';
    bell2.frequency.setValueAtTime(3951.07, chimeStart);
    bellGain2.gain.setValueAtTime(0.001, now);
    bellGain2.gain.setValueAtTime(0.32, chimeStart);
    bellGain2.gain.exponentialRampToValueAtTime(0.0001, chimeStart + 0.85);

    bell2.connect(bellGain2);
    bellGain2.connect(ctx.destination);
    bell2.start(chimeStart);
    bell2.stop(chimeStart + 0.85);

    // Brillo / armónico superior ~5920 Hz
    const bell3 = ctx.createOscillator();
    const bellGain3 = ctx.createGain();
    bell3.type = 'sine';
    bell3.frequency.setValueAtTime(5919.9, chimeStart);
    bellGain3.gain.setValueAtTime(0.001, now);
    bellGain3.gain.setValueAtTime(0.18, chimeStart);
    bellGain3.gain.exponentialRampToValueAtTime(0.0001, chimeStart + 0.45);

    bell3.connect(bellGain3);
    bellGain3.connect(ctx.destination);
    bell3.start(chimeStart);
    bell3.stop(chimeStart + 0.45);

    // --- 3. Tintineo de monedas de plata en la gaveta ("clink-chink-ting") ---
    const coinPings = [
      { delay: 0.11, freq: 2489, gain: 0.16, decay: 0.14 },
      { delay: 0.17, freq: 3136, gain: 0.20, decay: 0.18 },
      { delay: 0.23, freq: 2793, gain: 0.15, decay: 0.13 },
      { delay: 0.30, freq: 3520, gain: 0.18, decay: 0.19 },
      { delay: 0.37, freq: 4186, gain: 0.14, decay: 0.15 },
    ];

    coinPings.forEach(({ delay, freq, gain, decay }) => {
      const pingTime = now + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, pingTime);

      g.gain.setValueAtTime(0.001, now);
      g.gain.setValueAtTime(gain, pingTime);
      g.gain.exponentialRampToValueAtTime(0.0001, pingTime + decay);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(pingTime);
      osc.stop(pingTime + decay);
    });
  }
}

export const sound = new SoundService();
