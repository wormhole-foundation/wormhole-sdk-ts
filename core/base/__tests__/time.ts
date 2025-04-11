import { time } from './../src/index.js';

describe("Time Tests", function () {

  const assertTimeDelta = (d1: Date, d2: Date, h: number, m: number, s: number) => {
    const delta = d2.valueOf() - d1.valueOf();
    const expectedDelta = ((h * 60 * 60) + (m * 60) + s) * 1000;

    // Ensure the delta is within 1000 milliseconds of the expected value
    // There will be a little variance here just due to CPU time
    const deltaDelta = Math.abs(delta - expectedDelta);
    expect(deltaDelta < 1000);
  }

  it("should generate a Date in the future", function () {
    const d = new Date();
    const fiveHours = time.expiration(5, 0, 0);
    const fiveMinutes = time.expiration(0, 5, 0);
    const fiveSeconds = time.expiration(0, 0, 5);
    const tenHoursFiveMinutesThirtySeconds = time.expiration(10, 5, 30);

    assertTimeDelta(d, fiveHours, 5, 0, 0);
    assertTimeDelta(d, fiveMinutes, 0, 5, 0);
    assertTimeDelta(d, fiveSeconds, 0, 0, 5);
    assertTimeDelta(d, tenHoursFiveMinutesThirtySeconds, 10, 5, 30);
  });
});
