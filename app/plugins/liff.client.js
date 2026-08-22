import liff from '@line/liff'

export default defineNuxtPlugin(() => {
  const config =
    useRuntimeConfig()

  const state = reactive({
    initialized: false,
    role: null,
    loggedIn: false,
    error: null,
  })

  let initializePromise = null

  const normalizeRole = (
    role
  ) => {
    const normalized =
      String(
        role || ''
      )
        .trim()
        .toUpperCase()

    if (
      ![
        'TEACHER',
        'STUDENT',
      ].includes(
        normalized
      )
    ) {
      throw new Error(
        `不支援的 LIFF Role：${role}`
      )
    }

    return normalized
  }

  const getLiffId = (
    role
  ) => {
    const normalized =
      normalizeRole(role)

    if (
      normalized ===
      'TEACHER'
    ) {
      return config.public
        .teacherLiffId
    }

    return config.public
      .studentLiffId
  }

  const initialize = async (
    role
  ) => {
    const normalizedRole =
      normalizeRole(role)

    const liffId =
      getLiffId(
        normalizedRole
      )

    if (!liffId) {
      throw new Error(
        normalizedRole ===
        'TEACHER'
          ? '找不到 NUXT_PUBLIC_TEACHER_LIFF_ID'
          : '找不到 NUXT_PUBLIC_STUDENT_LIFF_ID'
      )
    }

    if (
      state.initialized &&
      state.role ===
        normalizedRole
    ) {
      return true
    }

    if (
      state.initialized &&
      state.role !==
        normalizedRole
    ) {
      throw new Error(
        '目前頁面已使用另一個 LIFF 初始化，請重新開啟正確的老師或學生 LIFF 網址'
      )
    }

    if (initializePromise) {
      await initializePromise

      return true
    }

    initializePromise =
      liff.init({
        liffId,
      })

    try {
      state.error = null

      await initializePromise

      state.initialized = true

      state.role =
        normalizedRole

      state.loggedIn =
        liff.isLoggedIn()

      return true
    } catch (error) {
      state.error = error

      state.initialized = false

      state.role = null

      console.error(
        'LIFF 初始化失敗：',
        error
      )

      throw error
    } finally {
      initializePromise =
        null
    }
  }

  const login = async (
    role
  ) => {
    await initialize(
      role
    )

    if (
      liff.isLoggedIn()
    ) {
      state.loggedIn = true

      return true
    }

    liff.login({
      redirectUri:
        window.location.href,
    })

    return false
  }

  const logout = () => {
    if (
      liff.isLoggedIn()
    ) {
      liff.logout()
    }

    state.loggedIn = false
  }

  const isLoggedIn = () => {
    if (
      !state.initialized
    ) {
      return false
    }

    return liff.isLoggedIn()
  }

  const getIdToken = async (
    role
  ) => {
    await initialize(
      role
    )

    if (
      !liff.isLoggedIn()
    ) {
      return null
    }

    return (
      liff.getIDToken() ||
      null
    )
  }

  const getProfile = async (
    role
  ) => {
    await initialize(
      role
    )

    if (
      !liff.isLoggedIn()
    ) {
      return null
    }

    return await liff
      .getProfile()
  }

  return {
    provide: {
      liff: {
        state,

        instance:
          liff,

        initialize,

        login,

        logout,

        isLoggedIn,

        getIdToken,

        getProfile,
      },
    },
  }
})