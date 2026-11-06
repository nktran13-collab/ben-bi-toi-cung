/**
 * Web Audio API synthesizer for FM Bell Chimes and completion sounds.
 * Generates pure harmonic bells without external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Resonant FM Bell Chime when habit countdown reaches 0.
   * Carrier + Modulator creates realistic metallic chime resonance.
   */
  public playBellChime(frequency = 523.25) { // C5
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.4, now + 0.015);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      masterGain.connect(ctx.destination);

      // Carrier Oscillator
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(frequency, now);

      // Harmonic Overtones for singing bell feel
      const carrier2 = ctx.createOscillator();
      carrier2.type = 'triangle';
      carrier2.frequency.setValueAtTime(frequency * 2.02, now); // slightly detuned octave
      const carrier2Gain = ctx.createGain();
      carrier2Gain.gain.setValueAtTime(0.15, now);
      carrier2Gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      carrier2.connect(carrier2Gain);
      carrier2Gain.connect(masterGain);

      // Modulator Oscillator (for metallic FM bell transient)
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(frequency * 1.414, now); // irrational harmonic ratio

      // Modulator depth envelope
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(frequency * 1.8, now);
      modGain.gain.exponentialRampToValueAtTime(1, now + 0.6); // fast decay of metallic bite

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      carrier.connect(masterGain);

      // Start and Stop
      carrier.start(now);
      carrier2.start(now);
      modulator.start(now);

      carrier.stop(now + 3.0);
      carrier2.stop(now + 2.0);
      modulator.stop(now + 2.0);
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  /**
   * Celebratory chime sequence when user confirms habit completion with long-press.
   */
  public playSuccessChime() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playSoftChime(freq, 0.25, 1.2);
      }, idx * 110);
    });
  }

  /**
   * Soft melodic bell chime for notifications and tests
   */
  public playSoftChime(frequency = 659.25, volume = 0.2, duration = 1.0) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }

  /**
   * Tactile click tone when pressing start/pause
   */
  public playTap(isStart: boolean = true) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStart ? 600 : 400, now);
      osc.frequency.exponentialRampToValueAtTime(isStart ? 800 : 300, now + 0.04);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Audio error', e);
    }
  }
  private silentGain: GainNode | null = null;
  private silentOsc: OscillatorNode | null = null;

  /**
   * Starts an inaudible silent audio carrier so mobile browsers keep MediaSession alive
   */
  public startSilentTrack() {
    const ctx = this.initContext();
    if (!ctx || this.silentOsc) return;
    try {
      this.silentOsc = ctx.createOscillator();
      this.silentGain = ctx.createGain();
      this.silentGain.gain.setValueAtTime(0.00001, ctx.currentTime); // Inaudible
      this.silentOsc.connect(this.silentGain);
      this.silentGain.connect(ctx.destination);
      this.silentOsc.start();
    } catch {
      // Ignore if blocked
    }
  }

  public stopSilentTrack() {
    try {
      if (this.silentOsc) {
        this.silentOsc.stop();
        this.silentOsc.disconnect();
        this.silentOsc = null;
      }
      if (this.silentGain) {
        this.silentGain.disconnect();
        this.silentGain = null;
      }
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new SoundEngine();
