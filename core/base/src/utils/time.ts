export const expiration = (hours: number = 0, minutes: number = 0, seconds: number = 0): Date => {
  return (new Date(Date.now() + (((hours*60*60) + (minutes*60) + seconds) * 1000)));
}
