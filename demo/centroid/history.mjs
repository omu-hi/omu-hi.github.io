export class LossHistory {
  constructor(initialLoss, capacity = 360) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('capacity must be at least 2');
    this.capacity = capacity;
    this.reset(initialLoss);
  }

  reset(loss) {
    this.validate(loss);
    this.index = 0;
    this.samples = [{ index: 0, loss }];
    this.ceiling = niceCeiling(loss);
  }

  record(loss) {
    this.validate(loss);
    this.samples.push({ index: ++this.index, loss });
    if (this.samples.length > this.capacity) this.samples.shift();
    // Keep the scale stable when the error decreases, so progress is visible.
    this.ceiling = Math.max(this.ceiling, niceCeiling(loss));
  }

  validate(loss) {
    if (!Number.isFinite(loss) || loss < 0) throw new RangeError('loss must be finite and nonnegative');
  }

  get view() {
    const first = this.samples[0].index;
    return { samples: this.samples, first, last: Math.max(first + 10, this.index), ceiling: this.ceiling };
  }
}

function niceCeiling(value) {
  const padded = Math.max(1, value * 1.1);
  const unit = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / unit) * unit;
}
