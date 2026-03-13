import { BracketStyles } from '../types/types'
import { FaTrophy } from 'react-icons/fa'

export const teams = [
  'Red',
  'Green',
  'Blue',
  'Magenta',
  'Yellow',
  'Orange',
  'Light Blue',
  'Violet',
  'Black',
  'Very Very Light Blueish Color',
  'Grey',
  'Aquamarine',
  'Brown',
]

export const bracketStyles: BracketStyles = {
  textColor: '#ECFEE8',
  teamNameColor: '#41337A',
  loseScoreColor: '#6EA4BF',
  winScoreColor: '#FAA916',
  roundColor: '#331E36',
  dividerColor: '#331E36',
  connectorColor: '#FAA916',
  titleFontSize: 24,
  basicFontSize: 16,
  teamHeight: 24,
  teamWidth: 140,
  teamGapX: 20,
  teamGapY: 10,
  bracketGap: 20,
  matchIcons: {
    12: { winner: { icon: FaTrophy, color: '#FAA916' } },
    13: { winner: { icon: FaTrophy, color: '#FAA916' } },
    25: { winner: { icon: FaTrophy, color: '#FAA916' } },
    26: { winner: { icon: FaTrophy, color: '#FAA916' } },
  },
}
