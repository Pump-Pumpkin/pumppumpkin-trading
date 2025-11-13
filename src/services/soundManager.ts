export class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private masterVolume: number = 0.7;
  private soundEnabled: boolean = true;
  private soundCategories: Map<string, number> = new Map();

  constructor() {
    this.initializeAudioContext();
    this.initializeSoundCategories();
    this.loadSounds();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private async loadSounds() {
    const soundFiles = {
      // Only the essential sounds as requested
      'tab_switch': this.generateMechanicalSwitch(),          // Menu click
      'robinhood_success': this.loadRealChaChing(),           // Real cha-ching sound
      'robinhood_success_fallback': this.generateRobinhoodTradeSuccess(),  // Fallback procedural sound
      
      // Keep minimal infrastructure sounds for fallback
      'click': this.generateRealisticClick(),
    };

    for (const [name, generator] of Object.entries(soundFiles)) {
      try {
        const buffer = await generator;
        this.sounds.set(name, buffer);
      } catch (error) {
        console.warn(`Failed to generate sound: ${name}`, error);
      }
    }
  }

  private initializeSoundCategories() {
    this.soundCategories.set('ui', 0.8);         // UI interactions - increased for audible menu sounds
    this.soundCategories.set('trade', 0.6);      // Trade executions
    this.soundCategories.set('success', 0.9);    // Success notifications - increased for satisfying cha-ching
  }

  // Essential sound generation methods
  private async generateRealisticClick(): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('No audio context');
    
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.08, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / this.audioContext.sampleRate;
      const fundamental = Math.sin(2 * Math.PI * 800 * t);
      const harmonic1 = Math.sin(2 * Math.PI * 1600 * t) * 0.4;
      const harmonic2 = Math.sin(2 * Math.PI * 2400 * t) * 0.2;
      const envelope = Math.exp(-t * 25) * (1 - Math.exp(-t * 50));
      const noise = (Math.random() - 0.5) * 0.05;
      
      data[i] = (fundamental + harmonic1 + harmonic2 + noise) * envelope * 0.12;
    }
    
    return buffer;
  }

  private async generateMechanicalSwitch(): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('No audio context');
    
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.18, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / this.audioContext.sampleRate;
      // Two-stage mechanical switch for menu clicks
      const click1 = t < 0.06 ? Math.sin(450 * Math.PI * t) * Math.exp(-t * 40) * 0.5 : 0;
      const click2 = t > 0.08 ? Math.sin(650 * Math.PI * (t - 0.08)) * Math.exp(-(t - 0.08) * 35) * 0.4 : 0;
      data[i] = click1 + click2;
    }
    
    return buffer;
  }

  private async loadRealChaChing(): Promise<AudioBuffer> {
    // Try to load a real cha-ching sound, fallback to procedural
    try {
      // Option 1: Try to load from a URL (you can replace this with a real sound file)
      // const audioUrl = 'https://example.com/cha-ching.mp3';
      // return await this.loadAudioFromUrl(audioUrl);
      
      // Option 2: Use base64 encoded audio (more reliable)
      return await this.loadChaChinFromBase64();
    } catch (error) {
      console.warn('Failed to load real cha-ching sound, using procedural fallback');
      return await this.generateRobinhoodTradeSuccess();
    }
  }

  private async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('No audio context');
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  private async loadChaChinFromBase64(): Promise<AudioBuffer> {
    // Use enhanced procedural sound for now
    // In production, you could replace this with a base64-encoded real audio file like this:
    // 
    // const base64Audio = 'data:audio/mp3;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1f...';
    // const response = await fetch(base64Audio);
    // const arrayBuffer = await response.arrayBuffer();
    // return await this.audioContext!.decodeAudioData(arrayBuffer);
    
    return await this.generateRobinhoodTradeSuccess();
  }

  private async generateRobinhoodTradeSuccess(): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('No audio context');
    
    // REAL MONEY SOUND - Cash register + coin drops
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 1.5, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / this.audioContext.sampleRate;
      let sample = 0;
      
      // CASH REGISTER BELL - Initial "DING"
      if (t < 0.15) {
        const bellFreq = 1760; // A6 - classic cash register bell pitch
        const bellHit = Math.sin(bellFreq * 2 * Math.PI * t) * Math.exp(-t * 12);
        const bellRing = Math.sin(bellFreq * 1.5 * 2 * Math.PI * t) * Math.exp(-t * 8) * 0.6;
        const bellHarmonic = Math.sin(bellFreq * 2.5 * 2 * Math.PI * t) * Math.exp(-t * 15) * 0.4;
        sample += (bellHit + bellRing + bellHarmonic) * 0.8;
      }
      
      // COIN DROPS - Multiple coins hitting surface
      // Coin 1 - Large coin (quarter) at 0.1s
      if (t > 0.1 && t < 0.25) {
        const coinTime = t - 0.1;
        const coin1Freq = 1200; // Metallic coin frequency
        const coin1Hit = Math.sin(coin1Freq * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 18);
        const coin1Bounce = Math.sin(coin1Freq * 0.8 * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 12) * 0.5;
        sample += (coin1Hit + coin1Bounce) * 0.6;
      }
      
      // Coin 2 - Medium coin (nickel) at 0.2s
      if (t > 0.2 && t < 0.35) {
        const coinTime = t - 0.2;
        const coin2Freq = 1400;
        const coin2Hit = Math.sin(coin2Freq * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 20);
        const coin2Ring = Math.sin(coin2Freq * 1.2 * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 15) * 0.4;
        sample += (coin2Hit + coin2Ring) * 0.5;
      }
      
      // Coin 3 - Small coin (dime) at 0.3s
      if (t > 0.3 && t < 0.45) {
        const coinTime = t - 0.3;
        const coin3Freq = 1800;
        const coin3Hit = Math.sin(coin3Freq * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 25);
        const coin3Ping = Math.sin(coin3Freq * 1.5 * 2 * Math.PI * coinTime) * Math.exp(-coinTime * 20) * 0.3;
        sample += (coin3Hit + coin3Ping) * 0.4;
      }
      
      // MONEY RUSTLING - Paper money sound
      if (t > 0.15 && t < 0.8) {
        const rustleTime = t - 0.15;
        // Create paper rustling noise using filtered white noise
        const noise = (Math.random() - 0.5) * 2;
        const rustleFilter = Math.sin(800 * 2 * Math.PI * rustleTime) * Math.exp(-rustleTime * 3);
        const rustle = noise * rustleFilter * 0.1;
        sample += rustle;
      }
      
      // CASH DRAWER SLIDE - Mechanical cash drawer opening
      if (t > 0.4 && t < 0.7) {
        const slideTime = t - 0.4;
        const slideFreq = 150; // Low mechanical frequency
        const slide = Math.sin(slideFreq * 2 * Math.PI * slideTime) * Math.exp(-slideTime * 8) * 0.3;
        const slideRattle = (Math.random() - 0.5) * Math.exp(-slideTime * 6) * 0.15;
        sample += slide + slideRattle;
      }
      
      // FINAL COIN SETTLE - Last coin rolling to a stop
      if (t > 0.6 && t < 1.2) {
        const settleTime = t - 0.6;
        const settleFreq = 900;
        const roll = Math.sin(settleFreq * 2 * Math.PI * settleTime) * Math.exp(-settleTime * 4) * 0.3;
        const rollBounce = Math.sin(settleFreq * 0.7 * 2 * Math.PI * settleTime) * Math.exp(-settleTime * 6) * 0.2;
        sample += roll + rollBounce;
      }
      
      data[i] = sample;
      
      // Apply soft limiting to prevent clipping
      if (data[i] > 0.95) data[i] = 0.95;
      if (data[i] < -0.95) data[i] = -0.95;
    }
    
    return buffer;
  }

  // Core playback method - SELECTIVE
  public async play(soundName: string, category: string = 'ui', volumeMultiplier: number = 1.0) {
    // Only allow UI navigation sounds, block all trade/success sounds
    if (category !== 'ui' || soundName === 'robinhood_success') {
      return; // Block trade completion and other non-UI sounds
    }

    if (!this.soundEnabled || !this.audioContext || !this.sounds.has(soundName)) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const buffer = this.sounds.get(soundName)!;
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    const categoryVolume = this.soundCategories.get(category) || 0.5;
    const finalVolume = this.masterVolume * categoryVolume * volumeMultiplier;
    
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.value = finalVolume;

    source.start(0);
  }

  // Only the essential public methods requested by the user
  public playTabSwitch() { 
    this.play('tab_switch', 'ui', 1.5); 
  }
  
  public playTradeOpenSuccess() { 
    this.play('robinhood_success', 'success', 0.5); 
  }

  // Robinhood-style "cha-ching" sound for trade completion (louder and more satisfying)
  public playTradeComplete() {
    this.play('robinhood_success', 'success', 1.0); // Full volume for maximum satisfaction
  }

  // Convenience methods for all the enhanced sounds - MOST DISABLED FOR BETTER UX
  public playModalOpen() { /* Disabled for better UX */ }
  public playModalClose() { /* Disabled for better UX */ }
  public playButtonPress() { /* Disabled for better UX */ }
  public playButtonRelease() { /* Disabled for better UX */ }
  public playLeverageAdjust() { /* Disabled for better UX */ }
  public playTradeConfirm() { /* Disabled for better UX */ }
  public playAmountInput() { /* Disabled for better UX */ }
  public playDirectionSelect() { /* Disabled for better UX */ }
  public playInputFocus() { /* Disabled for better UX */ }
  public playInputChange() { /* Disabled for better UX */ }
  public playToggleOn() { /* Disabled for better UX */ }
  public playToggleOff() { /* Disabled for better UX */ }

  // Original convenience methods with enhanced sounds - MOST DISABLED
  public playClick() { /* Disabled for better UX */ }
  public playTap() { /* Disabled for better UX */ }
  public playSwitch() { this.play('switch', 'ui', 0.3); } // Keep for menu navigation
  public playHover() { /* Disabled for better UX */ }
  public playPositionOpen() { /* Disabled for better UX */ }
  public playPositionClose() { /* Disabled for better UX */ }
  public playTradeSuccess() { this.play('trade_success', 'success', 0.4); } // Keep but subtle
  public playOrderFilled() { /* Disabled for better UX */ }
  public playProfitSmall() { /* Disabled for better UX */ }
  public playProfitBig() { /* Disabled for better UX */ }
  public playLossGentle() { /* Disabled for better UX */ }
  public playLiquidationWarning() { /* Disabled for better UX */ }
  public playMarginCall() { /* Disabled for better UX */ }
  public playNotification() { /* Disabled for better UX */ }
  public playSuccessChime() { /* Disabled for better UX */ }
  public playErrorGentle() { /* Disabled for better UX */ }
  public playAchievement() { /* Disabled for better UX */ }
  public playPriceTick() { /* Disabled for better UX */ }
  public playPriceUp() { /* Disabled for better UX */ }
  public playPriceDown() { /* Disabled for better UX */ }

  // Settings and controls
  public setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    this.saveSettings();
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setCategoryVolume(category: string, volume: number) {
    this.soundCategories.set(category, Math.max(0, Math.min(1, volume)));
    this.saveSettings();
  }

  public getCategoryVolume(category: string): number {
    return this.soundCategories.get(category) || 0.5;
  }

  public setTheme(theme: 'epic' | 'minimal' | 'professional') {
    // No-op since we only have minimal sounds now
  }

  private saveSettings() {
    try {
      localStorage.setItem('soundSettings', JSON.stringify({
        masterVolume: this.masterVolume,
        soundEnabled: this.soundEnabled,
        categoryVolumes: Object.fromEntries(this.soundCategories)
      }));
    } catch (error) {
      console.warn('Failed to save sound settings:', error);
    }
  }

  public loadSettings() {
    try {
      const saved = localStorage.getItem('soundSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.masterVolume = settings.masterVolume ?? 0.7;
        this.soundEnabled = settings.soundEnabled ?? true;
        
        if (settings.categoryVolumes) {
          for (const [category, volume] of Object.entries(settings.categoryVolumes)) {
            this.soundCategories.set(category, volume as number);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load sound settings:', error);
    }
  }
}

export const soundManager = new SoundManager();
