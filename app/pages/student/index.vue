<script setup>
definePageMeta({
  middleware: 'student-auth',
})

// ============================================================
// Nuxt / Auth
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

const resetSaving =
  ref(false)

const resettingId =
  ref('')

const errorMessage =
  ref('')

const successMessage =
  ref('')

const student =
  ref(null)

const courses =
  ref([])

const packages =
  ref([])

const auditLogs =
  ref([])

const auditActions =
  ref([])

// ============================================================
// Course Filters
// ============================================================

const courseFilters =
  reactive({
    courseId: '',
    status: '',
  })

// ============================================================
// Audit Filters
// ============================================================

const auditFilters =
  reactive({
    actorRole: '',
    action: '',
  })

// ============================================================
// Reset Dialog
// ============================================================

const showResetDialog =
  ref(false)

const resetPackage =
  ref(null)

// ============================================================
// Taipei Today
// ============================================================

const getTaipeiToday =
  () => {
    return new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Asia/Taipei',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      },
    ).format(
      new Date(),
    )
  }

// ============================================================
// Reset Form
// ============================================================

const resetForm =
  reactive({
    purchasedCycles: 1,

    startDate:
      getTaipeiToday(),
  })

// ============================================================
// Reset Preview
// ============================================================

const resetSessionsPerCycle =
  computed(() => {
    return Number(
      resetPackage.value
        ?.sessions_per_cycle ||
      0,
    )
  })

const resetPricePerCycle =
  computed(() => {
    return Number(
      resetPackage.value
        ?.price_per_cycle ||
      0,
    )
  })

const resetPurchasedCycles =
  computed(() => {
    const parsed =
      Number.parseInt(
        String(
          resetForm.purchasedCycles ||
          1,
        ),
        10,
      )

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed <= 0
    ) {
      return 1
    }

    return parsed
  })

const resetTotalSessions =
  computed(() => {
    return (
      resetSessionsPerCycle.value *
      resetPurchasedCycles.value
    )
  })

const resetTotalPrice =
  computed(() => {
    return (
      resetPricePerCycle.value *
      resetPurchasedCycles.value
    )
  })

// ============================================================
// Format
// ============================================================

const formatDateTime = (
  value,
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(
      value,
    )
  }

  return new Intl.DateTimeFormat(
    'zh-TW',
    {
      timeZone:
        'Asia/Taipei',

      year:
        'numeric',

      month:
        '2-digit',

      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      hourCycle:
        'h23',
    },
  ).format(
    date,
  )
}

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
// Audit Labels
// ============================================================

const getActorLabel = (
  role,
) => {
  if (
    role === 'TEACHER'
  ) {
    return '老師'
  }

  if (
    role === 'STUDENT'
  ) {
    return '學生'
  }

  return role || '-'
}

const getActionLabel = (
  action,
) => {
  const map = {
    CREATE:
      '新增',

    UPDATE:
      '修改',

    CANCEL:
      '取消',

    RESTORE:
      '恢復',

    RENEW:
      'Reset / 新一輪',

    DELETE:
      '刪除',

    BIND:
      '綁定',

    UNBIND:
      '解除綁定',
  }

  return (
    map[action] ||
    action ||
    '-'
  )
}

const getEntityLabel = (
  entityType,
) => {
  const map = {
    PACKAGE:
      '課程方案',

    ATTENDANCE:
      '上課紀錄',

    STUDENT:
      '學生資料',

    MAKEUP:
      '補課紀錄',

    LEAVE:
      '請假紀錄',

    LINE_IDENTITY:
      'LINE 綁定',
  }

  return (
    map[entityType] ||
    entityType ||
    '-'
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
// Query
// ============================================================

const buildQuery =
  () => {
    const query = {}

    if (
      courseFilters.courseId
    ) {
      query.courseId =
        courseFilters.courseId
    }

    if (
      courseFilters.status
    ) {
      query.packageStatus =
        courseFilters.status
    }

    if (
      auditFilters.actorRole
    ) {
      query.actorRole =
        auditFilters.actorRole
    }

    if (
      auditFilters.action
    ) {
      query.auditAction =
        auditFilters.action
    }

    return query
  }

// ============================================================
// Load Student Workspace
// ============================================================

const loadWorkspace =
  async () => {
    loading.value =
      true

    try {
      const response =
        await $fetch(
          '/api/student/workspace',
          {
            query:
              buildQuery(),
          },
        )

      student.value =
        response.student ||
        null

      courses.value =
        response.courses ||
        []

      packages.value =
        response.packages ||
        []

      auditLogs.value =
        response.auditLogs ||
        []

      auditActions.value =
        response.auditActions ||
        []
    }
    catch (error) {
      console.error(
        '學生首頁載入失敗：',
        error,
      )

      throw error
    }
    finally {
      loading.value =
        false
    }
  }

// ============================================================
// Student LIFF Login
// ============================================================

const loginStudent =
  async () => {
    authenticating.value =
      true

    errorMessage.value =
      ''

    try {
      // ======================================================
      // 1. Initialize Student LIFF
      // ======================================================

      await $liff.initialize(
        'STUDENT',
      )

      // ======================================================
      // 2. LINE 尚未登入
      // ======================================================

      if (
        !$liff.isLoggedIn()
      ) {
        await $liff.login(
          'STUDENT',
        )

        return
      }

      // ======================================================
      // 3. 先確認既有 Session
      // ======================================================

      const existingSession =
        await authStore
          .fetchStudentMe({
            force: true,
          })

      if (
        existingSession?.success &&
        authStore.isStudent
      ) {
        // ====================================================
        // 已登入，但尚未綁定 students
        // ====================================================

        if (
          !authStore.linked
        ) {
          await navigateTo(
            '/student/link',
          )

          return
        }

        await loadWorkspace()

        return
      }

      // ======================================================
      // 4. LINE ID Token
      // ======================================================

      const idToken =
        await $liff.getIdToken(
          'STUDENT',
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
          '/api/auth/student/line',
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
          '學生 LINE 登入失敗',
        )
      }

      // ======================================================
      // 6. 再確認 Session
      // ======================================================

      const sessionResult =
        await authStore
          .fetchStudentMe({
            force: true,
          })

      if (
        !sessionResult?.success ||
        !authStore.isStudent
      ) {
        throw new Error(
          'LINE 驗證成功，但學生 Session 建立失敗',
        )
      }

      // ======================================================
      // 7. 尚未綁 students
      // ======================================================

      if (
        !authStore.linked
      ) {
        await navigateTo(
          '/student/link',
        )

        return
      }

      // ======================================================
      // 8. Load Workspace
      // ======================================================

      await loadWorkspace()
    }
    catch (error) {
      console.error(
        'Student LIFF 登入失敗：',
        error,
      )

      errorMessage.value =
        getErrorMessage(
          error,
          'LINE 登入失敗，請重新開啟 Student LIFF',
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
    await loginStudent()
  }

// ============================================================
// Clear Course Filter
// ============================================================

const clearCourseFilters =
  async () => {
    courseFilters.courseId =
      ''

    courseFilters.status =
      ''

    try {
      await loadWorkspace()
    }
    catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '課程資料查詢失敗',
        )
    }
  }

// ============================================================
// Clear Audit Filter
// ============================================================

const clearAuditFilters =
  async () => {
    auditFilters.actorRole =
      ''

    auditFilters.action =
      ''

    try {
      await loadWorkspace()
    }
    catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '操作紀錄查詢失敗',
        )
    }
  }

// ============================================================
// Search Workspace
// ============================================================

const searchWorkspace =
  async () => {
    errorMessage.value =
      ''

    try {
      await loadWorkspace()
    }
    catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '資料查詢失敗',
        )
    }
  }

// ============================================================
// Open Reset
// ============================================================

const openReset = (
  packageData,
) => {
  resetPackage.value =
    packageData

  resetForm.purchasedCycles =
    1

  resetForm.startDate =
    getTaipeiToday()

  showResetDialog.value =
    true
}

// ============================================================
// Close Reset
// ============================================================

const closeReset =
  () => {
    if (
      resetSaving.value
    ) {
      return
    }

    showResetDialog.value =
      false

    resetPackage.value =
      null
  }

// ============================================================
// Submit Reset
// ============================================================

const submitReset =
  async () => {
    if (
      resetSaving.value ||
      !resetPackage.value
    ) {
      return
    }

    resetSaving.value =
      true

    resettingId.value =
      String(
        resetPackage.value.id,
      )

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/workspace/reset',
          {
            method: 'POST',

            body: {
              packageId:
                resetPackage.value.id,

              purchasedCycles:
                resetPurchasedCycles.value,

              startDate:
                resetForm.startDate,
            },
          },
        )

      successMessage.value =
        response.message ||
        '新一輪已開始'

      showResetDialog.value =
        false

      resetPackage.value =
        null

      await loadWorkspace()
    }
    catch (error) {
      console.error(
        'Reset 失敗：',
        error,
      )

      errorMessage.value =
        getErrorMessage(
          error,
          'Reset 失敗',
        )
    }
    finally {
      resetSaving.value =
        false

      resettingId.value =
        ''
    }
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loginStudent()
  },
)
</script>

<template>
  <main class="student-page">
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
          正在確認學生身分...
        </p>
      </section>

      <!-- ====================================================
           Login Error
           ==================================================== -->

      <section
        v-else-if="
          errorMessage &&
          !authStore.isStudent
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
           Student Page
           ==================================================== -->

      <template v-else>
        <!-- ==================================================
             Header
             ================================================== -->

        <header class="page-header">
          <div>
            <span>
              TapLife
            </span>

            <h1>
              {{
                student?.name ||
                '我的課程'
              }}
            </h1>

            <p>
              查看課程進度、完成日期與完整操作紀錄。
            </p>
          </div>
        </header>

        <!-- ==================================================
             Message
             ================================================== -->

        <div
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </div>

        <div
          v-if="successMessage"
          class="success-message"
        >
          {{ successMessage }}
        </div>

        <!-- ==================================================
             Loading
             ================================================== -->

        <div
          v-if="loading"
          class="empty-state"
        >
          載入資料中...
        </div>

        <template v-else>
          <!-- ================================================
               Courses
               ================================================ -->

          <section class="section">
            <div class="section-header">
              <div>
                <span>
                  My Courses
                </span>

                <h2>
                  我的課程
                </h2>
              </div>
            </div>

            <!-- ==============================================
                 Filters
                 ============================================== -->

            <div class="filters">
              <label>
                <span>
                  課程
                </span>

                <select
                  v-model="
                    courseFilters.courseId
                  "
                >
                  <option value="">
                    全部課程
                  </option>

                  <option
                    v-for="
                      course in courses
                    "
                    :key="course.id"
                    :value="course.id"
                  >
                    {{ course.name }}
                  </option>
                </select>
              </label>

              <label>
                <span>
                  狀態
                </span>

                <select
                  v-model="
                    courseFilters.status
                  "
                >
                  <option value="">
                    全部狀態
                  </option>

                  <option value="ACTIVE">
                    進行中
                  </option>

                  <option value="COMPLETED">
                    已完成
                  </option>

                  <option value="CANCELLED">
                    已取消
                  </option>
                </select>
              </label>

              <button
                type="button"
                @click="
                  searchWorkspace
                "
              >
                查詢
              </button>

              <button
                type="button"
                class="secondary"
                @click="
                  clearCourseFilters
                "
              >
                清除
              </button>
            </div>

            <!-- ==============================================
                 Course Table
                 ============================================== -->

            <StudentStudentCourseTable
              :packages="
                packages
              "
              :resetting-id="
                resettingId
              "
              @reset="
                openReset
              "
            />
          </section>

          <!-- ================================================
               Audit Log
               ================================================ -->

          <section class="section audit-section">
            <div class="section-header">
              <div>
                <span>
                  Audit Log
                </span>

                <h2>
                  操作紀錄
                </h2>

                <p>
                  老師與學生對你的資料所做的修改都會保留。
                </p>
              </div>

              <span class="log-count">
                {{ auditLogs.length }}
                筆
              </span>
            </div>

            <!-- ==============================================
                 Filters
                 ============================================== -->

            <div class="filters audit-filters">
              <label>
                <span>
                  操作者
                </span>

                <select
                  v-model="
                    auditFilters.actorRole
                  "
                >
                  <option value="">
                    全部
                  </option>

                  <option value="TEACHER">
                    老師
                  </option>

                  <option value="STUDENT">
                    學生
                  </option>
                </select>
              </label>

              <label>
                <span>
                  操作
                </span>

                <select
                  v-model="
                    auditFilters.action
                  "
                >
                  <option value="">
                    全部
                  </option>

                  <option
                    v-for="
                      action in
                        auditActions
                    "
                    :key="action"
                    :value="action"
                  >
                    {{
                      getActionLabel(
                        action,
                      )
                    }}
                  </option>
                </select>
              </label>

              <button
                type="button"
                @click="
                  searchWorkspace
                "
              >
                查詢
              </button>

              <button
                type="button"
                class="secondary"
                @click="
                  clearAuditFilters
                "
              >
                清除
              </button>
            </div>

            <!-- ==============================================
                 Audit Table
                 ============================================== -->

            <div class="audit-table-wrapper">
              <table
                v-if="
                  auditLogs.length
                "
                class="audit-table"
              >
                <thead>
                  <tr>
                    <th>
                      時間
                    </th>

                    <th>
                      操作者
                    </th>

                    <th>
                      類型
                    </th>

                    <th>
                      操作
                    </th>

                    <th>
                      課程
                    </th>

                    <th>
                      說明
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="
                      log in auditLogs
                    "
                    :key="log.id"
                  >
                    <td data-label="時間">
                      {{
                        formatDateTime(
                          log.created_at,
                        )
                      }}
                    </td>

                    <td data-label="操作者">
                      <strong>
                        {{
                          getActorLabel(
                            log.actor_role,
                          )
                        }}
                      </strong>

                      <small>
                        {{
                          log.actor_name ||
                          ''
                        }}
                      </small>
                    </td>

                    <td data-label="類型">
                      {{
                        getEntityLabel(
                          log.entity_type,
                        )
                      }}
                    </td>

                    <td data-label="操作">
                      {{
                        getActionLabel(
                          log.action,
                        )
                      }}
                    </td>

                    <td data-label="課程">
                      {{
                        log.course_name ||
                        '-'
                      }}
                    </td>

                    <td data-label="說明">
                      {{
                        log.note ||
                        '-'
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                v-else
                class="empty-state compact"
              >
                沒有符合條件的操作紀錄。
              </div>
            </div>
          </section>
        </template>
      </template>
    </div>

    <!-- ======================================================
         Reset Dialog
         ====================================================== -->

    <Teleport to="body">
      <div
        v-if="
          showResetDialog &&
          resetPackage
        "
        class="dialog-mask"
        @click.self="
          closeReset
        "
      >
        <form
          class="dialog"
          @submit.prevent="
            submitReset
          "
        >
          <header>
            <div>
              <span>
                Reset
              </span>

              <h2>
                開始新一輪
              </h2>
            </div>

            <button
              type="button"
              :disabled="
                resetSaving
              "
              @click="
                closeReset
              "
            >
              ×
            </button>
          </header>

          <!-- ================================================
               Course
               ================================================ -->

          <section class="reset-course">
            <span>
              課程
            </span>

            <strong>
              {{
                resetPackage
                  .course_name
              }}
            </strong>

            <p>
              上一輪：
              {{
                resetPackage
                  .used_sessions
              }}
              /
              {{
                resetPackage
                  .total_sessions
              }}
              堂
            </p>
          </section>

          <!-- ================================================
               Cycles
               ================================================ -->

          <label>
            <span>
              新一輪購買幾期
            </span>

            <input
              v-model.number="
                resetForm.purchasedCycles
              "
              type="number"
              min="1"
              max="100"
              step="1"
              required
              :disabled="
                resetSaving
              "
            >
          </label>

          <div class="cycle-buttons">
            <button
              v-for="
                count in [
                  1,
                  2,
                  3,
                ]
              "
              :key="count"
              type="button"
              :class="{
                selected:
                  resetPurchasedCycles ===
                  count,
              }"
              @click="
                resetForm.purchasedCycles =
                  count
              "
            >
              {{ count }}
              期
            </button>
          </div>

          <!-- ================================================
               Start Date
               ================================================ -->

          <label>
            <span>
              新一輪開始日期
            </span>

            <input
              v-model="
                resetForm.startDate
              "
              type="date"
              required
              :disabled="
                resetSaving
              "
            >
          </label>

          <!-- ================================================
               Preview
               ================================================ -->

          <section class="reset-preview">
            <div>
              <span>
                每期
              </span>

              <strong>
                {{
                  resetSessionsPerCycle
                }}
                堂
              </strong>
            </div>

            <div>
              <span>
                新總堂數
              </span>

              <strong>
                {{
                  resetTotalSessions
                }}
                堂
              </strong>
            </div>

            <div>
              <span>
                新方案金額
              </span>

              <strong>
                $
                {{
                  formatMoney(
                    resetTotalPrice,
                  )
                }}
              </strong>
            </div>
          </section>

          <!-- ================================================
               Payment
               ================================================ -->

          <div class="payment-notice">
            <strong>
              Reset 後會先顯示未付款
            </strong>

            <p>
              付款仍由老師人工確認，因此學生自行開始新一輪不會自行把方案標記成已付款。
            </p>
          </div>

          <!-- ================================================
               Footer
               ================================================ -->

          <footer>
            <button
              type="button"
              :disabled="
                resetSaving
              "
              @click="
                closeReset
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="confirm"
              :disabled="
                resetSaving
              "
            >
              {{
                resetSaving
                  ? '處理中...'
                  : `開始 ${resetTotalSessions} 堂新一輪`
              }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.student-page {
  min-height: 100vh;
  padding: 24px 16px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 1050px;
  margin: 0 auto;
}

/* ============================================================
   Login
   ============================================================ */

.login-state {
  min-height: calc(100vh - 80px);
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
  font-size: 28px;
}

.page-header p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 9px;
}

/* ============================================================
   Message
   ============================================================ */

.error-message,
.success-message {
  margin-top: 11px;
  padding: 10px;
  border-radius: 9px;
  font-size: 9px;
}

.error-message {
  background: #fff0f0;
  color: #c94343;
}

.success-message {
  background: #eaf7ec;
  color: #418b4b;
}

/* ============================================================
   Section
   ============================================================ */

.section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.section-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.section-header h2 {
  margin: 3px 0 0;
  font-size: 18px;
}

.section-header p {
  margin: 4px 0 0;
  color: #999999;
  font-size: 8px;
}

.log-count {
  color: #999999;
  font-size: 8px;
}

/* ============================================================
   Filters
   ============================================================ */

.filters {
  display: grid;
  grid-template-columns:
    2fr
    1fr
    auto
    auto;
  gap: 7px;
  margin: 10px 0 9px;
  padding: 10px;
  background: #ffffff;
  border-radius: 11px;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filters label span {
  color: #888888;
  font-size: 7px;
}

.filters select {
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 8px;
  font-size: 8px;
}

.filters button {
  align-self: flex-end;
  min-height: 36px;
  padding: 0 13px;
  border: 0;
  background: #222222;
  border-radius: 8px;
  color: #ffffff;
  font-size: 8px;
}

.filters button.secondary {
  background: #eeeeee;
  color: #555555;
}

/* ============================================================
   Audit
   ============================================================ */

.audit-section {
  margin-top: 28px;
}

.audit-table-wrapper {
  overflow-x: auto;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  background: #ffffff;
  border-radius: 13px;
}

.audit-table th,
.audit-table td {
  padding: 10px;
  border-bottom: 1px solid #eeeeee;
  text-align: left;
  vertical-align: top;
}

.audit-table th {
  background: #fafafa;
  color: #888888;
  font-size: 7px;
  font-weight: 500;
  white-space: nowrap;
}

.audit-table td {
  color: #666666;
  font-size: 8px;
}

.audit-table tbody tr:last-child td {
  border-bottom: 0;
}

.audit-table strong {
  color: #333333;
  font-size: 8px;
}

.audit-table small {
  display: block;
  margin-top: 2px;
  color: #aaaaaa;
  font-size: 7px;
}

/* ============================================================
   Empty
   ============================================================ */

.empty-state {
  margin-top: 12px;
  padding: 30px;
  background: #ffffff;
  border-radius: 13px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

.empty-state.compact {
  margin-top: 9px;
  padding: 20px;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  background: rgb(0 0 0 / 48%);
}

.dialog {
  width: 100%;
  max-width: 470px;
  max-height: calc(100vh - 34px);
  overflow-y: auto;
  padding: 19px;
  background: #ffffff;
  border-radius: 19px;
}

.dialog > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dialog header span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.dialog h2 {
  margin: 3px 0 0;
}

.dialog header button {
  width: 33px;
  height: 33px;
  border: 0;
  background: #eeeeee;
  border-radius: 50%;
}

.reset-course {
  margin-top: 13px;
  padding: 11px;
  background: #f7f7f7;
  border-radius: 10px;
}

.reset-course span {
  color: #999999;
  font-size: 7px;
}

.reset-course strong {
  display: block;
  margin-top: 4px;
}

.reset-course p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 8px;
}

.dialog > label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
}

.dialog label span {
  color: #777777;
  font-size: 8px;
}

.dialog input {
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
}

.cycle-buttons {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 7px;
}

.cycle-buttons button {
  min-height: 34px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #666666;
  font-size: 8px;
}

.cycle-buttons button.selected {
  background: #222222;
  color: #ffffff;
}

.reset-preview {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  background: #222222;
  border-radius: 10px;
}

.reset-preview > div {
  padding: 8px;
  background: rgb(255 255 255 / 8%);
  border-radius: 7px;
}

.reset-preview span {
  display: block;
  color: rgb(255 255 255 / 50%);
  font-size: 7px;
}

.reset-preview strong {
  display: block;
  margin-top: 3px;
  color: #ffffff;
  font-size: 9px;
}

.payment-notice {
  margin-top: 10px;
  padding: 10px;
  background: #fff5df;
  border-radius: 9px;
}

.payment-notice strong {
  color: #856319;
  font-size: 8px;
}

.payment-notice p {
  margin: 4px 0 0;
  color: #8d7541;
  font-size: 7px;
  line-height: 1.6;
}

.dialog footer {
  display: grid;
  grid-template-columns:
    1fr
    2fr;
  gap: 7px;
  margin-top: 15px;
}

.dialog footer button {
  min-height: 40px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
}

.dialog footer .confirm {
  background: #222222;
  color: #ffffff;
}

button:disabled {
  opacity: 0.4;
}

/* ============================================================
   Mobile
   ============================================================ */

@media (
  max-width: 650px
) {
  .filters {
    grid-template-columns:
      1fr
      1fr;
  }

  .filters button {
    align-self: stretch;
  }

  .audit-table-wrapper {
    overflow: visible;
  }

  .audit-table,
  .audit-table thead,
  .audit-table tbody,
  .audit-table tr,
  .audit-table th,
  .audit-table td {
    display: block;
    width: 100%;
  }

  .audit-table {
    background: transparent;
  }

  .audit-table thead {
    display: none;
  }

  .audit-table tr {
    margin-bottom: 7px;
    padding: 11px;
    background: #ffffff;
    border-radius: 11px;
  }

  .audit-table td {
    display: grid;
    grid-template-columns:
      75px
      1fr;
    gap: 8px;
    padding: 5px 0;
    border: 0;
  }

  .audit-table td::before {
    content:
      attr(
        data-label
      );
    color: #aaaaaa;
    font-size: 7px;
  }
}

@media (
  max-width: 480px
) {
  .student-page {
    padding: 18px 12px 45px;
  }

  .reset-preview {
    grid-template-columns:
      1fr;
  }
}
</style>