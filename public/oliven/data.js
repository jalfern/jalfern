// Oliven map data. Everything the map knows lives here, so it can grow over time.
// Coordinates are pixels on the aerial photo (1374 x 1458, north up, ~1.83 px per foot).
// Anything in [[double brackets]] is still a guess or a gap for Jon to fill.

window.OLIVEN = {
  // Net harvest per block, in pounds. Add a line per year.
  yields: {
    'block-1': [{ year: 2026, lbs: 6072 }],
    'block-2': [{ year: 2026, lbs: 4065 }],
    'block-3': [{ year: 2026, lbs: 5527 }],
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
      kicker: 'Vineyard · Cabernet Sauvignon',
      text: 'The narrow north end of the vineyard, running up toward the barn.',
      needs: 'Real block name, where the line falls, clone and rootstock, year planted',
      label: [860, 620, 10],
      chart: 'block-1',
    },
    {
      id: 'block-2',
      group: 'vineyard',
      name: 'Block 2',
      kicker: 'Vineyard · Cabernet Sauvignon',
      text: 'The middle of the vineyard, where it starts to widen out.',
      needs: 'Real block name, where the line falls, clone and rootstock, year planted',
      label: [760, 1010, 10],
      chart: 'block-2',
    },
    {
      id: 'block-3',
      group: 'vineyard',
      name: 'Block 3',
      kicker: 'Vineyard · Cabernet Sauvignon',
      text: 'The wide south end of the vineyard, along the road.',
      needs: 'Real block name, where the line falls, clone and rootstock, year planted',
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
      id: 'garden',
      name: 'Garden',
      kicker: 'Land',
      text: 'Formal beds and gravel paths north of the house.',
      needs: 'What grows here',
      label: [1215, 780, 10],
    },
    {
      id: 'house',
      name: 'The house',
      kicker: 'Buildings',
      text: 'Main house, on the east side of the vineyard loop.',
      needs: '',
      label: [1120, 1000, 55],
    },
    {
      id: 'pool',
      name: 'Pool & terrace',
      kicker: 'Buildings',
      text: 'Pool, terrace and a small pool house east of the house.',
      needs: 'Confirm this is the pool',
      label: [1282, 1000, 20],
    },
    {
      id: 'cottage',
      name: 'Cottage',
      kicker: 'Buildings',
      text: 'Second building south of the house, among the trees.',
      needs: 'What this building is',
      label: [1216, 1135, 50],
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
