// import * as stateUtil from './stateUtil'
// const stateKey = 'history'
// export { stateKey }

// import { _ } from '../imports/lodash'
// import fetch from 'isomorphic-unfetch'

// const host = process.env.host

// interface IStateHistory {
//   fetchedHistory: {
//     error?: string
//     data?: {
//       Items: {
//         created: Date
//         options: string
//         text: string
//       }[]
//     }
//   }
// }

// let initialState: IStateHistory = {
//   fetchedHistory: null,
// }

// const stateManager = stateUtil.createStateManager(
//   stateKey,
//   '1.0.0',
//   initialState,
//   {
//     useLocalStorage: false,
//   }
// )
// export { stateManager }

// export async function fetchHistory() {
//   const res = await fetch(host + '/cows-list')
//   const fetchedHistory = await res.json()
//   stateManager.produce(draftState => {
//     draftState.fetchedHistory = fetchedHistory
//   })
// }
