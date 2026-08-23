<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

// ============================================================
// Route
// ============================================================

const route =
  useRoute()

const studentId =
  computed(() => {
    return String(
      route.params.id ||
      ''
    )
  })

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

const actionSaving =
  ref(false)

const historySavingId =
  ref('')

const packageSaving =
  ref(false)

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

const attendance =
  ref([])

// ============================================================
// Package Dialog
// ============================================================

const showPackageDialog =
  ref(false)

const selectedRenewPackage =
  ref(null)

// ============================================================
// Packages
// ============================================================

const activePackages =
  computed(() => {
    return packages.value.filter(
      (
        item
      ) => {
        return (
          item.status ===
          'ACTIVE'
        )
      }
    )
  })

const completedPackages =
  computed(() => {
    return packages.value.filter(
      (
        item
      ) => {
        return (
          item.status !==
          'ACTIVE'
        )
      }
    )
  })

// ============================================================
// Error
// ============================================================

const getErrorMessage = (
  error,
  fallback
) => {
  return (
    error?.data
      ?.statusMessage ||
    error?.statusMessage ||
    error?.message ||
    fallback
  )
}

// ============================================================
// Load
// ============================================================

const loadWorkspace =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/workspace/${studentId.value}`
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

      attendance.value =
        response.attendance ||
        []
    } catch (
      error
    ) {
      console.error(
        '學生工作區載入失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '學生資料載入失敗'
        )
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Attendance
// ============================================================

const submitAttendance =
  async (
    payload
  ) => {
    if (
      actionSaving.value
    ) {
      return
    }

    actionSaving.value =
      true

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/workspace/${studentId.value}`,
          {
            method:
              'POST',

            body: {
              action:
                'ATTENDANCE',

              courseId:
                payload.courseId,

              classDate:
                payload.classDate,

              status:
                payload.status,

              note:
                payload.note,
            },
          }
        )

      successMessage.value =
        response.message ||
        '紀錄已更新'

      await loadWorkspace()
    } catch (
      error
    ) {
      console.error(
        '簽到 / 請假失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '紀錄更新失敗'
        )
    } finally {
      actionSaving.value =
        false
    }
  }

// ============================================================
// History Change
// ============================================================

const changeHistory =
  async (
    payload
  ) => {
    if (
      historySavingId.value
    ) {
      return
    }

    historySavingId.value =
      String(
        payload.attendanceId
      )

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/workspace/${studentId.value}`,
          {
            method:
              'POST',

            body: {
              action:
                'ATTENDANCE',

              courseId:
                payload.courseId,

              classDate:
                payload.classDate,

              status:
                payload.status,

              note:
                payload.note,
            },
          }
        )

      successMessage.value =
        response.message ||
        '歷史紀錄已修改'

      await loadWorkspace()
    } catch (
      error
    ) {
      console.error(
        '修改歷史紀錄失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '歷史紀錄修改失敗'
        )
    } finally {
      historySavingId.value =
        ''
    }
  }

// ============================================================
// New Package
// ============================================================

const openNewPackage =
  () => {
    selectedRenewPackage.value =
      null

    showPackageDialog.value =
      true
  }

// ============================================================
// Renew Package
// ============================================================

const openRenewPackage =
  (
    packageData
  ) => {
    selectedRenewPackage.value =
      packageData

    showPackageDialog.value =
      true
  }

// ============================================================
// Save Package
// ============================================================

const savePackage =
  async (
    payload
  ) => {
    if (
      packageSaving.value
    ) {
      return
    }

    packageSaving.value =
      true

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/workspace/${studentId.value}`,
          {
            method:
              'POST',

            body:
              payload,
          }
        )

      successMessage.value =
        response.message ||
        '方案已更新'

      showPackageDialog.value =
        false

      selectedRenewPackage.value =
        null

      await loadWorkspace()
    } catch (
      error
    ) {
      console.error(
        '方案操作失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '方案操作失敗'
        )
    } finally {
      packageSaving.value =
        false
    }
  }

// ============================================================
// Format
// ============================================================

const formatDate = (
  value
) => {
  if (
    !value
  ) {
    return '-'
  }

  return String(
    value
  ).slice(
    0,
    10
  )
}

const formatMoney = (
  value
) => {
  return new Intl
    .NumberFormat(
      'zh-TW',
      {
        maximumFractionDigits:
          0,
      }
    )
    .format(
      Number(
        value || 0
      )
    )
}

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loadWorkspace()
  }
)
</script>

<template>
  <main class="student-workspace">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 學生列表
          </NuxtLink>

          <span>
            Student
          </span>

          <h1>
            {{
              student?.name ||
              '學生'
            }}
          </h1>

          <p
            v-if="
              student
            "
          >
            {{
              student.user_id
                ? 'LINE 已綁定'
                : 'LINE 尚未綁定'
            }}
          </p>
        </div>

        <button
          type="button"
          class="new-package-button"
          :disabled="
            !student ||
            student.status !==
              'ACTIVE'
          "
          @click="
            openNewPackage
          "
        >
          ＋ 新增課程方案
        </button>
      </header>

      <!-- ====================================================
           Main Navigation
           ==================================================== -->

      <nav class="main-nav">
        <NuxtLink
          to="/teacher"
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

      <!-- ====================================================
           Messages
           ==================================================== -->

      <div
        v-if="
          errorMessage
        "
        class="error-message"
      >
        {{
          errorMessage
        }}
      </div>

      <div
        v-if="
          successMessage
        "
        class="success-message"
      >
        {{
          successMessage
        }}
      </div>

      <!-- ====================================================
           Loading
           ==================================================== -->

      <div
        v-if="
          loading
        "
        class="empty-state"
      >
        載入學生資料中...
      </div>

      <template
        v-else-if="
          student
        "
      >
        <!-- ==================================================
             Packages
             ================================================== -->

        <section class="section">
          <header class="section-header">
            <div>
              <span>
                Courses
              </span>

              <h2>
                課程方案
              </h2>
            </div>
          </header>

          <div
            v-if="
              activePackages.length
            "
            class="package-list"
          >
            <TeacherStudentPackageCard
              v-for="
                packageData in
                  activePackages
              "
              :key="
                packageData.id
              "
              :package-data="
                packageData
              "
              @renew="
                openRenewPackage
              "
            />
          </div>

          <div
            v-else
            class="empty-state compact"
          >
            這位學生目前還沒有進行中的課程方案。
          </div>
        </section>

        <!-- ==================================================
             Attendance Form
             ================================================== -->

        <section class="section">
          <TeacherStudentAttendanceQuickForm
            :courses="
              courses
            "
            :packages="
              packages
            "
            :saving="
              actionSaving
            "
            @submit="
              submitAttendance
            "
          />
        </section>

        <!-- ==================================================
             Attendance History
             ================================================== -->

        <section class="section">
          <TeacherStudentAttendanceHistory
            :records="
              attendance
            "
            :saving-id="
              historySavingId
            "
            @change="
              changeHistory
            "
          />
        </section>

        <!-- ==================================================
             Old Packages
             ================================================== -->

        <section
          v-if="
            completedPackages.length
          "
          class="section"
        >
          <header class="section-header">
            <div>
              <span>
                Previous Rounds
              </span>

              <h2>
                過去方案
              </h2>
            </div>
          </header>

          <div class="history-packages">
            <article
              v-for="
                packageData in
                  completedPackages
              "
              :key="
                packageData.id
              "
            >
              <div>
                <strong>
                  {{
                    packageData.course_name
                  }}
                </strong>

                <span>
                  第
                  {{
                    packageData.cycle_no
                  }}
                  輪
                  ・
                  {{
                    packageData.used_sessions
                  }}
                  /
                  {{
                    packageData.total_sessions
                  }}
                  堂
                </span>
              </div>

              <div>
                <strong>
                  $
                  {{
                    formatMoney(
                      packageData.price
                    )
                  }}
                </strong>

                <span>
                  開始
                  {{
                    formatDate(
                      packageData.start_date
                    )
                  }}
                </span>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>

    <!-- ======================================================
         Package Dialog
         ====================================================== -->

    <TeacherStudentPackageDialog
      v-model="
        showPackageDialog
      "
      :courses="
        courses
      "
      :package-data="
        selectedRenewPackage
      "
      :saving="
        packageSaving
      "
      @submit="
        savePackage
      "
    />
  </main>
</template>

<style scoped>
.student-workspace {
  min-height: 100vh;
  padding: 26px 18px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
}

.back-link {
  display: block;
  margin-bottom: 12px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 3px 0 0;
  font-size: 29px;
}

.page-header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 8px;
}

.new-package-button {
  min-height: 41px;
  padding: 0 13px;
  border: 0;
  background: #222222;
  border-radius: 10px;
  color: #ffffff;
  font-size: 9px;
}

/* ============================================================
   Nav
   ============================================================ */

.main-nav {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 17px;
}

.main-nav a {
  padding: 10px;
  background: #ffffff;
  border-radius: 9px;
  color: #777777;
  font-size: 8px;
  text-align: center;
  text-decoration: none;
}

/* ============================================================
   Message
   ============================================================ */

.error-message,
.success-message {
  margin-top: 10px;
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
   Sections
   ============================================================ */

.section {
  margin-top: 18px;
}

.section-header span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.section-header h2 {
  margin: 3px 0 8px;
  font-size: 17px;
}

/* ============================================================
   Packages
   ============================================================ */

.package-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ============================================================
   Old Packages
   ============================================================ */

.history-packages {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-packages article {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px;
  background: #ffffff;
  border-radius: 11px;
}

.history-packages article > div:last-child {
  text-align: right;
}

.history-packages strong {
  display: block;
  font-size: 9px;
}

.history-packages span {
  display: block;
  margin-top: 3px;
  color: #999999;
  font-size: 7px;
}

/* ============================================================
   Empty
   ============================================================ */

.empty-state {
  margin-top: 12px;
  padding: 30px;
  background: #ffffff;
  border-radius: 14px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

.empty-state.compact {
  margin-top: 0;
  padding: 20px;
}

button:disabled {
  opacity: 0.4;
}

@media (
  max-width: 520px
) {
  .student-workspace {
    padding: 18px 12px 45px;
  }

  .page-header {
    align-items: flex-start;
  }

  .new-package-button {
    padding: 0 10px;
    font-size: 8px;
  }
}
</style>