<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

// ============================================================
// Nuxt
// ============================================================

const {
  $liff,
} = useNuxtApp()

const authStore =
  useAuthStore()

// ============================================================
// State
// ============================================================

const authenticating =
  ref(true)

const loading =
  ref(false)

const errorMessage =
  ref('')

const students =
  ref([])

const keyword =
  ref('')

// ============================================================
// Filter
// ============================================================

const filteredStudents =
  computed(() => {
    const normalized =
      keyword.value
        .trim()
        .toLowerCase()

    if (!normalized) {
      return students.value
    }

    return students.value.filter(
      (student) => {
        return String(
          student.name || '',
        )
          .toLowerCase()
          .includes(
            normalized,
          )
      },
    )
  })

// ============================================================
// Format
// ============================================================

const formatMoney = (
  value,
) => {
  return new Intl.NumberFormat(
    'zh-TW',
    {
      maximumFractionDigits: 0,
    },
  ).format(
    Number(
      value || 0,
    ),
  )
}

// ============================================================
// Error
// ============================================================

const getErrorMessage = (
  error,
  fallback,
) => {
  return (
    error?.data?.statusMessage ||
    error?.statusMessage ||
    error?.message ||
    fallback
  )
}

// ============================================================
// Load Students
// ============================================================

const loadStudents =
  async () => {
    loading.value = true

    try {
      const response =
        await $fetch(
          '/api/teacher/workspace',
        )

      students.value =
        response.students ||
        []
    }
    catch (error) {
      console.error(
        '學生列表載入失敗：',
        error,
      )

      throw error
    }
    finally {
      loading.value = false
    }
  }

// ============================================================
// Teacher LIFF Login
// ============================================================

const loginTeacher =
  async () => {
    authenticating.value =
      true

    errorMessage.value =
      ''

    try {
      // ======================================================
      // 1. Initialize Teacher LIFF
      // ======================================================

      await $liff.initialize(
        'TEACHER',
      )

      // ======================================================
      // 2. LINE 尚未登入
      // ======================================================

      if (
        !$liff.isLoggedIn()
      ) {
        await $liff.login(
          'TEACHER',
        )

        return
      }

      // ======================================================
      // 3. 先確認既有 Session
      // ======================================================

      const existingSession =
        await authStore
          .fetchTeacherMe({
            force: true,
          })

      if (
        existingSession?.success &&
        authStore.isTeacher
      ) {
        await loadStudents()

        return
      }

      // ======================================================
      // 4. 取得 LINE ID Token
      // ======================================================

      const idToken =
        await $liff.getIdToken(
          'TEACHER',
        )

      if (!idToken) {
        throw new Error(
          'LINE 已登入，但無法取得 ID Token',
        )
      }

      // ======================================================
      // 5. LINE → TapLife Login
      // ======================================================

      const loginResponse =
        await $fetch(
          '/api/auth/teacher/line',
          {
            method: 'POST',

            body: {
              idToken,
            },
          },
        )

      if (
        !loginResponse?.success
      ) {
        throw new Error(
          '老師 LINE 登入失敗',
        )
      }

      // ======================================================
      // 6. 確認 Session Cookie
      // ======================================================

      const sessionResult =
        await authStore
          .fetchTeacherMe({
            force: true,
          })

      if (
        !sessionResult?.success ||
        !authStore.isTeacher
      ) {
        throw new Error(
          'LINE 驗證成功，但系統登入 Session 建立失敗',
        )
      }

      // ======================================================
      // 7. Load Dashboard
      // ======================================================

      await loadStudents()
    }
    catch (error) {
      console.error(
        'Teacher LIFF 登入失敗：',
        error,
      )

      errorMessage.value =
        getErrorMessage(
          error,
          'LINE 登入失敗，請重新開啟 Teacher LIFF',
        )
    }
    finally {
      authenticating.value =
        false
    }
  }

// ============================================================
// Retry
// ============================================================

const retryLogin =
  async () => {
    await loginTeacher()
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loginTeacher()
  },
)
</script>

<template>
  <main class="teacher-dashboard">
    <div class="container">
      <!-- ====================================================
           Login
           ==================================================== -->

      <section
        v-if="authenticating"
        class="login-state"
      >
        <div class="spinner" />

        <h1>
          LINE 登入中
        </h1>

        <p>
          正在確認老師身分...
        </p>
      </section>

      <!-- ====================================================
           Login Error
           ==================================================== -->

      <section
        v-else-if="
          errorMessage &&
          !authStore.isTeacher
        "
        class="login-state error"
      >
        <h1>
          無法登入
        </h1>

        <p>
          {{ errorMessage }}
        </p>

        <button
          type="button"
          @click="retryLogin"
        >
          重新登入
        </button>
      </section>

      <!-- ====================================================
           Dashboard
           ==================================================== -->

      <template v-else>
        <header class="page-header">
          <div>
            <span>
              TapLife
            </span>

            <h1>
              學生
            </h1>

            <p>
              點選學生即可查看課程、堂數與上課紀錄。
            </p>
          </div>
        </header>

        <!-- ==================================================
             Navigation
             ================================================== -->

        <nav class="main-nav">
          <NuxtLink
            to="/teacher"
            class="active"
          >
            學生管理
          </NuxtLink>

          <NuxtLink
            to="/teacher/courses"
          >
            課堂管理
          </NuxtLink>

          <NuxtLink
            to="/teacher/audit"
          >
            操作紀錄
          </NuxtLink>
        </nav>

        <!-- ==================================================
             Search
             ================================================== -->

        <section class="search-section">
          <input
            v-model="keyword"
            type="search"
            placeholder="搜尋學生姓名"
          >
        </section>

        <!-- ==================================================
             Error
             ================================================== -->

        <div
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </div>

        <!-- ==================================================
             Loading
             ================================================== -->

        <div
          v-if="loading"
          class="empty-state"
        >
          載入學生中...
        </div>

        <!-- ==================================================
             Student List
             ================================================== -->

        <section
          v-else-if="
            filteredStudents.length
          "
          class="student-list"
        >
          <NuxtLink
            v-for="
              student in
                filteredStudents
            "
            :key="student.id"
            :to="
              `/teacher/students/${student.id}`
            "
            class="student-card"
          >
            <header>
              <div>
                <span>
                  {{
                    student.user_id
                      ? 'LINE 已綁定'
                      : 'LINE 未綁定'
                  }}
                </span>

                <h2>
                  {{ student.name }}
                </h2>
              </div>

              <span class="arrow">
                ›
              </span>
            </header>

            <!-- ==============================================
                 No Package
                 ============================================== -->

            <div
              v-if="
                !student
                  .active_packages
                  ?.length
              "
              class="no-package"
            >
              尚未建立課程方案
            </div>

            <!-- ==============================================
                 Packages
                 ============================================== -->

            <section
              v-else
              class="package-list"
            >
              <article
                v-for="
                  packageData in
                    student.active_packages
                "
                :key="
                  packageData.id
                "
              >
                <div class="package-name">
                  <strong>
                    {{
                      packageData
                        .course_name
                    }}
                  </strong>

                  <span>
                    {{
                      packageData
                        .purchased_cycles ||
                      1
                    }}
                    期
                    ・
                    $
                    {{
                      formatMoney(
                        packageData.price,
                      )
                    }}
                  </span>
                </div>

                <div class="package-progress">
                  <strong>
                    {{
                      packageData
                        .used_sessions
                    }}
                    /
                    {{
                      packageData
                        .total_sessions
                    }}
                  </strong>

                  <span>
                    剩
                    {{
                      packageData
                        .remaining_sessions
                    }}
                    堂
                  </span>
                </div>
              </article>
            </section>
          </NuxtLink>
        </section>

        <!-- ==================================================
             Empty
             ================================================== -->

        <div
          v-else
          class="empty-state"
        >
          {{
            keyword
              ? '沒有符合條件的學生。'
              : '目前還沒有學生。'
          }}
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  min-height: 100vh;
  padding: 28px 18px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

/* ============================================================
   Login
   ============================================================ */

.login-state {
  min-height: calc(100vh - 88px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.login-state h1 {
  margin: 13px 0 0;
  font-size: 21px;
}

.login-state p {
  margin: 6px 0 0;
  color: #888888;
  font-size: 10px;
}

.login-state button {
  min-height: 39px;
  margin-top: 16px;
  padding: 0 18px;
  border: 0;
  background: #222222;
  border-radius: 9px;
  color: #ffffff;
  font-size: 9px;
}

.login-state.error h1 {
  color: #c94343;
}

.spinner {
  width: 29px;
  height: 29px;
  border: 3px solid #dddddd;
  border-top-color: #222222;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============================================================
   Header
   ============================================================ */

.page-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 30px;
}

.page-header p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 9px;
}

/* ============================================================
   Navigation
   ============================================================ */

.main-nav {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 18px;
}

.main-nav a {
  padding: 11px;
  background: #ffffff;
  border-radius: 10px;
  color: #777777;
  font-size: 9px;
  text-align: center;
  text-decoration: none;
}

.main-nav a.active {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Search
   ============================================================ */

.search-section {
  margin-top: 11px;
}

.search-section input {
  width: 100%;
  min-height: 42px;
  padding: 0 13px;
  border: 0;
  background: #ffffff;
  border-radius: 11px;
  outline: none;
  font-size: 10px;
}

/* ============================================================
   Students
   ============================================================ */

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.student-card {
  display: block;
  padding: 15px;
  background: #ffffff;
  border-radius: 15px;
  color: inherit;
  text-decoration: none;
}

.student-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.student-card header > div > span {
  color: #999999;
  font-size: 7px;
}

.student-card h2 {
  margin: 3px 0 0;
  font-size: 16px;
}

.arrow {
  color: #aaaaaa;
  font-size: 26px;
  line-height: 1;
}

/* ============================================================
   Package
   ============================================================ */

.package-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 11px;
}

.package-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  background: #f7f7f7;
  border-radius: 9px;
}

.package-name strong {
  display: block;
  font-size: 9px;
}

.package-name span {
  display: block;
  margin-top: 3px;
  color: #999999;
  font-size: 7px;
}

.package-progress {
  text-align: right;
}

.package-progress strong {
  display: block;
  font-size: 12px;
}

.package-progress span {
  display: block;
  margin-top: 2px;
  color: #888888;
  font-size: 7px;
}

.no-package {
  margin-top: 10px;
  padding: 9px;
  background: #fff5df;
  border-radius: 9px;
  color: #8d691d;
  font-size: 8px;
}

/* ============================================================
   Message
   ============================================================ */

.error-message {
  margin-top: 10px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 9px;
  color: #c94343;
  font-size: 9px;
}

.empty-state {
  margin-top: 12px;
  padding: 30px;
  background: #ffffff;
  border-radius: 14px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

@media (
  max-width: 480px
) {
  .teacher-dashboard {
    padding: 19px 12px 45px;
  }
}
</style>