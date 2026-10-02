// Oliven map data. Everything the map knows lives here, so it can grow over time.
// Coordinates are pixels on the aerial photo (1374 x 1458, north up, ~1.83 px per foot).
// Anything in [[double brackets]] is still a guess or a gap for Jon to fill.

window.OLIVEN = {
  // Net harvest per block, in pounds, from the Schramsberg weighmaster certificates.
  // Add a line per pick: { year, date, lbs, bins, cert }. A missing year means no tag yet.
  yields: {
    'block-1': [
      { year: 2022, date: '2022-09-28', lbs: 5147, bins: 7, cert: 1721 },
      { year: 2023, date: '2023-10-25', lbs: 8162, bins: 10, cert: 1838 },
      { year: 2024, date: '2024-09-30', lbs: 8696, bins: 10, cert: 1942 },
      { year: 2025, date: '2025-10-08', lbs: 11052, bins: 13, cert: 2049 },
      { year: 2026, date: '2026-09-23', lbs: 6072, bins: 7, cert: 2144 },
    ],
    'block-2': [
      { year: 2022, date: '2022-09-28', lbs: 3912, bins: 5, cert: 1722 },
      // Tag says 5,229 net, but gross 5,789 - tare 570 = 5,219.
      { year: 2023, date: '2023-10-25', lbs: 5229, bins: 6, cert: 1837 },
      { year: 2024, date: '2024-09-30', lbs: 6739, bins: 8, cert: 1944 },
      { year: 2025, date: '2025-10-08', lbs: 4381, bins: 5, cert: 2050 },
      { year: 2026, date: '2026-09-23', lbs: 4065, bins: 5, cert: 2142 },
    ],
    'block-3': [
      { year: 2022, date: '2022-09-22', lbs: 5519, bins: 8, cert: 1702 },
      { year: 2023, date: '2023-10-10', lbs: 6667, bins: 10, cert: 1787 },
      { year: 2024, date: '2024-09-30', lbs: 8343, bins: 10, cert: 1945 },
      { year: 2025, date: '2025-10-02', lbs: 10678, bins: 12, cert: 2036 },
      { year: 2026, date: '2026-09-23', lbs: 5527, bins: 7, cert: 2145 },
    ],
  },

  // Fruit and nut trees. e.g. { x: 1200, y: 1300, kind: 'fig', note: 'planted 2021' }
  trees: [],

  // Wildlife sightings. e.g. { x: 300, y: 900, what: 'otters', when: '2025-02' }
  sightings: [],

  // River high-water marks. e.g. { season: '2025–26', level: '[[ft at gauge]]', note: '' }
  river: [],

  features: [
    {
      id: 'block-1',
      group: 'vineyard',
      name: 'Block 1',
      kicker: 'Vineyard · Cabernet Sauvignon · Clone 30',
      text: 'The narrow north end of the vineyard, running up toward the barn.',
      needs: 'Where the block line really falls, rootstock, year planted',
      label: [860, 620, 10],
      chart: 'block-1',
    },
    {
      id: 'block-2',
      group: 'vineyard',
      name: 'Block 2',
      kicker: 'Vineyard · Cabernet Sauvignon · Clone 4',
      text: 'The middle of the vineyard, where it starts to widen out.',
      needs: 'Where the block line really falls, rootstock, year planted',
      label: [760, 1010, 10],
      chart: 'block-2',
    },
    {
      id: 'block-3',
      group: 'vineyard',
      name: 'Block 3',
      kicker: 'Vineyard · Cabernet Sauvignon · Clone 7',
      text: 'The wide south end of the vineyard, along the road.',
      needs: 'Where the block line really falls, rootstock, year planted',
      label: [560, 1270, 10],
      chart: 'block-3',
    },
    {
      id: 'pond',
      name: 'The pond',
      kicker: 'Water',
      text: 'Lined pond north of the vineyard, with aerators keeping the water moving.',
      needs: 'What it feeds, how many gallons, anything that lives in it',
      label: [985, 230, 8],
    },
    {
      id: 'river',
      name: 'River & oaks',
      kicker: 'Water · Wildlife',
      text: 'The line of big oaks on the west side follows the river.',
      needs: 'River name and route, this year’s high-water mark, where the otters were spotted',
      label: [330, 820, 40],
      chart: 'river',
    },
    {
      id: 'barn',
      name: 'Barn',
      kicker: 'Buildings',
      text: 'Metal-roofed barn and work yard at the top of the vineyard loop.',
      needs: 'What happens in here (equipment, crush, storage?)',
      label: [804, 408, 60],
    },
    {
      id: 'solar',
      name: 'Solar',
      kicker: 'Energy',
      text: 'Three rows of ground-mounted panels past the pond.',
      needs: 'Size of the array (kW), share of the property’s power',
      label: [1245, 215, 20],
    },
    {
      id: 'meadow',
      name: 'Meadow',
      kicker: 'Land',
      text: 'Open grass with mown paths and a loop, between the pond and the garden.',
      needs: 'Anything planted or grazed here',
      label: [1225, 560, 6],
    },
    {
      id: 'orchard',
      name: 'Orchard',
      kicker: 'Trees · Fruit',
      text: 'Fruit trees in a grid, split by gravel paths, north of the guest house.',
      needs: 'Which trees are where (kind, year planted)',
      label: [1156, 784, 18],
    },
    {
      id: 'roses',
      name: 'Rose garden',
      kicker: 'Gardens',
      text: 'Rose beds around a formal parterre.',
      needs: 'Rose varieties, what is at the center of the parterre',
      label: [1259, 790, 8],
    },
    {
      id: 'poolheat',
      name: 'Pool solar heater',
      kicker: 'Energy',
      text: 'Solar coils that heat the pool.',
      needs: '',
      label: [1358, 790, 6],
    },
    {
      id: 'house',
      name: 'Guest House',
      kicker: 'Buildings',
      text: 'Guest house on the east side of the vineyard loop, looking across the vines.',
      needs: '',
      label: [1120, 1000, 55],
    },
    {
      id: 'pool',
      name: 'Pool & pool house',
      kicker: 'Buildings',
      text: 'Pool and terrace, with the pool house on its north side.',
      needs: '',
      label: [1282, 996, 10],
    },
    {
      id: 'gym',
      name: 'Gym',
      kicker: 'Buildings',
      text: 'Small building behind the pool house.',
      needs: '',
      label: [1307, 894, 22],
    },
    {
      id: 'kitchen',
      name: 'Outdoor kitchen',
      kicker: 'Buildings',
      text: 'Covered outdoor kitchen just south of the pool.',
      needs: '',
      label: [1299, 1062, 16],
    },
    {
      id: 'cottage',
      name: 'Main House',
      kicker: 'Buildings',
      text: 'The main house, tucked among the big trees south of the guest house.',
      needs: '',
      label: [1233, 1132, 50],
    },
    {
      id: 'hedgerow',
      name: 'Roadside row',
      kicker: 'Trees',
      text: 'A single row of trees screening the vineyard from the road.',
      needs: 'What kind of trees (olives?)',
      label: [620, 1415, 30],
    },
  ],
}
