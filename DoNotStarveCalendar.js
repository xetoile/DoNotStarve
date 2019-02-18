/*
INPUT
- today: mandatory integer; number of the day, displayed in the top right corner of the screen
- isRoG: optional, defaults to false; whether we're counting pure DS (2 seasons) or RoG seasons (4)
- isDST: optional, defaults to false; for DST-specific phases of the moon
  (this will force isRoG to true for season calculations purposes)
- pace: optional, defaults to 'default', can be one of:
  'very short', 'short', 'default', 'long', 'very long';
  for now this param is NOT considered: the wiki is not consistent about it
OUTPUT
- getAll shows the structure
- getters or direct access to props exposed
*/

class DoNotStarveCalendar {
  constructor(cfg = {}) {
    // declare internals
    this._prepare(cfg);
    // do the calculation
    this._compute();
  }

  _prepare({today = 1, isRoG = false, isDST = false, pace = 'default', startingSeason = 'summer'}) {
    this._prepareToday(today);
    // pace will be called again when RoG is defined
    this._preparePace(pace);
    // the order is important: RoG then DST to ensure logic is preserved
    // (if DST then RoG, but if RoG gets reset later, it'll turn off DST)
    this._prepareIsRoG(isRoG);
    this._prepareIsDST(isDST);
    // do this at the end, we need to have pace "really" prepared (after RoG)
    this._prepareStartingSeason(startingSeason);
    // ordered phases
    this._phases = [
      "new moon",
      "waxing quarter",
      "first quarter",
      "waxing gibbous",
      "full moon",
      "waning gibbous",
      "last quarter",
      "waning quarter"
    ];
    // outputs
    this.phase = {
      label: '',
      day: 0,
      duration: 0
    };
    this.season = {
      current: {
        label: '',
        begins: {
          absolute: 0,
          relative: 0
        }
      },
      next: {
        label: '',
        begins: {
          absolute: 0,
          relative: 0
        }
      }
    };
  }

  _prepareToday(today) {
    // 1-indexed day: no zero allowed
    let test = !today || isNaN(today) || parseFloat(today) !== parseInt(today);
    test = test || today < 1 || !Number.isSafeInteger(parseInt(today));
    if (test) {
      throw new Error("today is required and must be a safe, positive integer");
    }
    this._today = parseInt(today);
  }

  _prepareIsDST(isDST) {
    this._isDST = isDST;
    // cannot have DST without RoG
    if (this._isDST && !this._isRoG) {
      this._prepareIsRoG(true);
    }
  }

  _prepareIsRoG(isRoG) {
    this._isRoG = isRoG;
    // cannot have DST without RoG
    if (!this._isRoG && this._isDST) {
      this._prepareIsDST(false);
    }
    // seasons depend on RoG (2 or 4), so we refresh
    this._preparePace(this._pace);
  }

  _prepareStartingSeason(season) {
    let index = this._seasons.indexOf(season);
    if (!~index) {
      throw new Error(`season ${season} must be one of ${this._seasons.join(', ')}`);
    }
    // cycle the arrays so that the starting season is the first element
    this._startingSeason = season;
    for (let i = 0; i < index; i++) {
      this._seasons.push(this._seasons.shift());
      this._seasonLengths.push(this._seasonLengths.shift());
    }
  }

  _preparePace(pace) {
    let baseSeasonLengths;
    // TODO bind with get paces() logic
    // sanitize pace and transform in day counts
    switch (pace) {
      case 'default':
        baseSeasonLengths = [20, 16];
        break;
      case 'very short':
      case 'short':
      case 'long':
      case 'very long':
        throw new Error(`pace value not implemented: ${pace}`);
      default:
        throw new Error("invalid pace value");
    }
    this._pace = pace;
    this._seasonLengths = [];
    // if RoG/DST, double the fun (4 seasons)
    // use the if-block occasion to populate seasons
    if (this._isRoG) {
      baseSeasonLengths = baseSeasonLengths.concat(baseSeasonLengths);
      this._seasons = ['autumn', 'winter', 'spring', 'summer'];
    } else {
      this._seasons = ['summer', 'winter'];
    }
    // populate seasonLengths: count days for each season
    this._seasonLengths.push.apply(this._seasonLengths, baseSeasonLengths);
  }

  _compute() {
    this._computePhase();
    this._computeSeason();
  }

  _computePhase() {
    if (this._isDST) {
      this._computePhaseDST();
    } else {
      this._computePhaseStandard();
    }
  }

  _computePhaseDST() {
    // cycle every 20 days...
    let moonReduced = this._today % 20;
    // ... but let's be human: 1 to 20
    if (moonReduced === 0) {
      moonReduced = 20;
    }
    // new or full moon
    if (moonReduced % 10 === 1) { // 1 or 11
      this.phase.label = this._phases[(moonReduced - 1) % 6]; // 0 (new) or 4 (full)
      this.phase.day = 1;
      this.phase.duration = 1;
      return;
    }
    // standard case: 3-day phase
    this.phase.duration = 3;
    // make up for the "missing" days (new [#1] and full [#11] = 1 day, others = 3 days)
    const moonWithOffset = moonReduced + (moonReduced > 11 ? 4 : 2);
    const remainder = Math.ceil(moonWithOffset % this.phase.duration);
    const division = Math.floor(moonWithOffset / this.phase.duration);
    // -1 if perfect division (because Math.floor won't have had any effect)
    this.phase.label = this._phases[division - !remainder];
    // once again, let's be human: 1 to 3
    this.phase.day = remainder ? remainder : this.phase.duration;
  }

  _computePhaseStandard() {
    this.phase.duration = 2;
    // take today as 0-indexed, divide by 2 since phases last 2 days, modulus 8 to loop over phases array
    this.phase.label = this._phases[Math.floor((this._today - 1) / 2) % 8];
    // whether we're on first or second day of the phase
    this.phase.day = this.phase.duration - this._today % this.phase.duration;
  }

  _computeSeason() {
    // helper to count days in seasons array
    const arrayAdder = (sum, item) => {
      return sum + item;
    };
    // 0-indexed modulus a full year, used for main job
    const todayReduced = (this._today - 1) % this._seasonLengths.reduce(arrayAdder, 0);
    // compute the season we're in by trying each and checking when we haven't gone over its end yet
    let i = 0, nextSeasonBeginsReduced = 0;
    do {
      nextSeasonBeginsReduced += this._seasonLengths[i];
      i++;
    } while (todayReduced >= nextSeasonBeginsReduced && i < this._seasonLengths.length);
    this.season.current.label = this._seasons[i - 1];
    this.season.current.duration = this._seasonLengths[i - 1];
    this.season.next.label = this._seasons[i % this._seasons.length];
    this.season.next.duration = this._seasonLengths[i % this._seasons.length];
    // using today (absolute day count, 1-indexed), offset the reduced day for next season to begin
    this.season.next.begins.absolute = this._today + nextSeasonBeginsReduced - todayReduced;
    this.season.next.begins.relative = this.season.next.begins.absolute - this._today;
    // provide the inverse calculation and make it 1-indexed (no absolute days in this equation)
    this.season.current.begins.relative = 1 + todayReduced - this._seasonLengths.slice(0, i - 1).reduce(arrayAdder, 0);
    // +1 here to make it 1-indexed as well (both numbers are 1-indexed, to the difference is not)
    this.season.current.begins.absolute = 1 + this._today - this.season.current.begins.relative;
  }

  getAll() {
    return Object.keys(this).filter((k) => {
      return k.substr(0, 1) !== '_' && typeof this[k] !== 'function';
    }).reduce((output, k) => {
      output[k] = this[k];
      return output;
    }, {});
  }

  get phases() {
    return this._phases.slice();
  }

  get seasons() {
    return this._seasons.slice();
  }

  get paces() {
    // TODO bind with _preparePace logic
    return ['very short', 'short', 'default', 'long', 'very long'];
  }

  get today() {
    return this._today;
  }

  get pace() {
    return this._pace;
  }

  get isRoG() {
    return this._isRoG;
  }

  get isDST() {
    return this._isDST;
  }

  get startingSeason() {
    return this._startingSeason;
  }

  set today(today) {
    this._prepareToday(today);
    this._compute();
  }

  set pace(pace) {
    this._preparePace(pace);
    this._compute();
  }

  set isRoG(isRoG) {
    this._prepareIsRoG(isRoG);
    this._prepareStartingSeason(
      this._seasons.includes(this._startingSeason)
      ? this._startingSeason
      : this._seasons[0] // random reset, but at least it's legal
    );
    this._compute();
  }

  set isDST(isDST) {
    this._prepareIsDST(isDST);
    this._compute();
  }

  set startingSeason(season) {
    this._prepareStartingSeason(season);
    this._compute();
  }
}