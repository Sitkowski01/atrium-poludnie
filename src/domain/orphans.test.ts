import { describe, expect, it } from 'vitest'
import { glueOrphans } from './orphans'

const N = ' '

describe('glueOrphans', () => {
  it('skleja jednoliterowe wyrazy z następnym', () => {
    expect(glueOrphans('63,8 m² · od południa, z balkonem')).toBe(`63,8${N}m²${N}· od południa, z${N}balkonem`)
    expect(glueOrphans('wnętrza i nasłonecznienie')).toBe(`wnętrza i${N}nasłonecznienie`)
  })
  it('obsługuje kilka pod rząd i początek tekstu', () => {
    expect(glueOrphans('W domu i w pracy')).toBe(`W${N}domu i${N}w${N}pracy`)
  })
  it('nie rusza końcówek wyrazów ani liczb', () => {
    expect(glueOrphans('Mieszkania od strony')).toBe('Mieszkania od strony')
    expect(glueOrphans('kawa, zanim wyjdziesz')).toBe('kawa, zanim wyjdziesz')
  })
  it('trzyma liczbę z jednostką', () => {
    expect(glueOrphans('4 pokoje · 86,9 m² · 5. piętro')).toBe(`4${N}pokoje${N}· 86,9${N}m²${N}· 5.${N}piętro`)
    expect(glueOrphans('od 411 tys. zł')).toBe(`od 411${N}tys. zł`)
  })
  it('jest idempotentne', () => {
    const once = glueOrphans('z balkonem i tarasem')
    expect(glueOrphans(once)).toBe(once)
  })
})
