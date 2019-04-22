//import * as React from 'react'

const React = require('react')

import * as flavorSaver from 'flavor-saver'

const { useState, useEffect } = React
import * as PubSub from 'pubsub-js'
import { _ } from './imports/lodash'
import * as immer from 'immer'

function log(...x) {
  if (console && console.log) {
    console.log('midboss', ...x)
  }
}

export interface IMidbossOptions<T> {
  useVerbose: boolean
  useFreeze: boolean
  useClone: boolean
  useLocalStorage: boolean
  localStorageFields?: Array<keyof T>
  onSave?: (t: T) => void
  onRestore?: (t: T) => T
  useImmer: boolean
}
export interface IMidbossLiveOptions {
  useVerbose: boolean
}
export interface IMidboss<T> {
  stateKey: string
  getState: () => T
  setState: (changes: Partial<T>) => any
  produce: (producer: (draftState: T) => void) => void
  subscribeComponent: (component: React.Component) => string
  subscribeHook: (callback: (state: T) => any) => string
  unSubscribe: (token: string) => void
  setOptions: (options: Partial<IMidbossLiveOptions>) => void
  getOptions: () => IMidbossOptions<T>
  rehydrate: (changes: Partial<T>) => any
}

function tryCloneAndFreeze<T>(
  state,
  saver: flavorSaver.IFlavorSaver<T>,
  options: IMidbossOptions<T>
) {
  let nextState = state

  if (options.useImmer) {
    // Handled for us automagically
  } else if (options.useClone) {
    nextState = _.cloneDeep(state)
  } else if (options.useFreeze && Object.freeze) {
    Object.freeze(nextState)
  }

  if (options.useLocalStorage && saver) {
    saver.save(nextState)
  }
  if (options.onSave) {
    options.onSave(nextState)
  }

  return nextState
}

function tryFreeze<T>(state, options: IMidbossOptions<T>) {
  if (options.useImmer) {
    // Don't freeze
  } else if (options.useFreeze && Object.freeze) {
    Object.freeze(tryFreeze)
  }
}

export function createMidboss<T>(
  stateKey,
  version: string,
  initialState: T,
  options: Partial<IMidbossOptions<T>>
): IMidboss<T> {
  let _options: IMidbossOptions<T> = _.defaults(options, {
    useFreeze: false,
    useClone: false,
    useLocalStorage: false,
    useImmer: true,
    localStorageFields: null,
  })

  let saver: flavorSaver.IFlavorSaver<T> = null

  if (_options.useLocalStorage) {
    saver = flavorSaver.create<T>(
      'state:' + stateKey,
      version,
      _options.localStorageFields
    )
  }

  let isRehydrated = false

  // Try to restore our local state
  if (_options.useLocalStorage) {
    if (_options.useVerbose) {
      log('restoring from local storage', initialState)
    }
    initialState = saver.restore(initialState)
    if (_options.useVerbose) {
      log('restored', initialState)
    }
  }
  if (_options.onRestore) {
    initialState = _options.onRestore(initialState)
  }

  let state = tryCloneAndFreeze(initialState, saver, _options)

  if (_options.useImmer) {
    state = immer.produce(state, draftState => {})
  }

  const getState = () => {
    return tryCloneAndFreeze(state, saver, _options)
  }
  const setState = (changes: Partial<T>, sync = false) => {
    if (_options.useImmer) {
      state = immer.produce(state, draftState => {
        _.assign(draftState, changes)
      })
    } else {
      state = tryFreeze(_.assign({}, state, changes), _options)
    }
    if (_options.useVerbose) {
      log('updated ' + stateKey)
    }
    if (sync) {
      PubSub.publishSync(stateKey)
    } else {
      PubSub.publish(stateKey) // With a frame delay
    }
  }

  return {
    stateKey,
    rehydrate: (changes: Partial<T>) => {
      if (!isRehydrated) {
        setState(changes)
        isRehydrated = true
        if (options.useVerbose) {
          log('rehydrated ' + stateKey)
        }
      }
    },
    setOptions: (options: Partial<IMidbossLiveOptions>) => {},
    getOptions: () => {
      return _options
    },

    produce: (producer: (draftState: T) => void, sync = true) => {
      if (_options.useImmer) {
        state = immer.produce(state, producer)
      } else {
        let nextState = _.cloneDeep(state)
        producer(nextState)
        nextState = tryCloneAndFreeze(nextState, saver, _options)
      }
      if (sync) {
        PubSub.publishSync(stateKey)
      } else {
        PubSub.publish(stateKey) // With a frame delay
      }
    },
    getState,
    setState,
    subscribeComponent: (component: React.Component) => {
      let token = PubSub.subscribe(stateKey, () => {
        component.forceUpdate()
      })
      if (options.useVerbose) {
        log('subscribed ' + stateKey + '|' + token)
      }
      return token
    },
    subscribeHook(callback: (state: T) => any) {
      let token = PubSub.subscribe(stateKey, () => {
        callback(getState())
      })
      if (_options.useVerbose) {
        log('subscribed hook ' + stateKey + '|' + token)
      }
      return token
    },
    unSubscribe: token => {
      if (_options.useVerbose) {
        log('unsubscribed ' + stateKey + '|' + token)
      }
      PubSub.unsubscribe(token)
    },
  }
}

// React hook
export function useSubscription<T>(midboss: IMidboss<T>): T {
  if (midboss.getOptions().useVerbose) {
    log('hook init', midboss.stateKey)
  }

  const [state, setState] = useState(midboss.getState()) as [
    T,
    (stateChange: Partial<T>) => void
  ]

  useEffect(() => {
    if (midboss.getOptions().useVerbose) {
      log('hook use effect', midboss.stateKey)
    }
    const handleStateChange = (newState: T) => {
      setState(newState)
    }
    let subscriptionToken = midboss.subscribeHook(handleStateChange)
    setState(midboss.getState())

    return () => {
      if (midboss.getOptions().useVerbose) {
        log('hook use effect cleanup', midboss.stateKey)
      }
      midboss.unSubscribe(subscriptionToken)
    }
  }, [])

  return state
}
