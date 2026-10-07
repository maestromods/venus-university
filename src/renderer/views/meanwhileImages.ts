import type { MeanwhileScene } from '@shared/meanwhile'
import { bgUrl } from './bgAssets'

/** Timetable location IDs are not background filenames. Keep that translation explicit. */
const BACKGROUNDS: Readonly<Record<string, string>> = {
  agora: 'cafeteria', apogee_club: 'club', bobbys_diner: 'restaurant', btb_arcade: 'arcade',
  cutetea: 'cute_tea', eastern_buffet: 'asian_food', fast_eats: 'fast_food', freights_books: 'bookstore',
  green_hill_park: 'park', kendall_library: 'library', lowrise_dorms: 'dorm_lounge',
  elysium_village: 'elysium_living_room', lumiere_fusion: 'fine_dining', palaestra_stadium: 'stadium',
  pino_cola_lounge: 'pinocola_lounge', reserve_bank_cafe: 'reserve_cafe', spring_mart: 'supermarket',
  stalestein_bar: 'bar', thorne_auditorium: 'auditorium', venus_quad: 'quad', whitman_greenhouse: 'greenhouse',
  future_cinema: 'theater', hotel_dreams: 'love_hotel', lotterdale_market: 'market', pastel_palace: 'bakery',
  pier_44: 'theme_park', riverside_aquarium: 'aquarium', riverside_mall: 'mall', selkie_beach: 'beach',
  veridan_museum: 'museum',
  room: 'lowrise_dorm_room'
}

export function meanwhileBackgroundKey(scene: Pick<MeanwhileScene, 'kind' | 'ref'>): string {
  if (scene.kind === 'class') return 'classroom'
  if (scene.kind === 'dorm') return 'dorm_lounge'
  return BACKGROUNDS[scene.ref] ?? scene.ref
}

/** Native encounters have no time/weather stamp, so use a neutral day illustration. */
export function meanwhileBackgroundUrl(scene: Pick<MeanwhileScene, 'kind' | 'ref'>): string | null {
  return bgUrl(meanwhileBackgroundKey(scene), 'day', false)
}
