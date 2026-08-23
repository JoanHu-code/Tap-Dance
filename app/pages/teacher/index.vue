<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

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

    if (
      !normalized
    ) {
      return students.value
    }

    return students.value.filter(
      (
        student
      ) => {
        return String(
          student.name ||
          ''
        )
          .toLowerCase()
          .includes(
            normalized
          )
      }
    )
  })

// ============================================================
// Format
// ============================================================

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
// Error
// ============================================================

const getErrorMessage = (
  error,
  fallback
) => {
  return (
    error?.data?.statusMessage ||
    error?.statusMessage ||
    error?.message ||
    fallback
  )
}

// ============================================================
// Load
// ============================================================

const loadStudents =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/workspace'
        )

      students.value =
        response.students ||
        []
    } catch (
      error
    ) {
      console.error(
        '學生列表載入失敗：',
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
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loadStudents()
  }
)
</script>

<template>
  <main class="teacher-dashboard">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <span>
            TapLife
          </span>

          <h1>
            學生
          </h1>

          <p>
            點選學生即可簽到、請假、查看堂數與開始下一輪。
          </p>
        </div>
      </header>

      <!-- ====================================================
           Main Navigation
           ==================================================== -->

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

      <!-- ====================================================
           Search
           ==================================================== -->

      <section class="search-section">
        <input
          v-model="
            keyword
          "
          type="search"
          placeholder="搜尋學生姓名"
        >
      </section>

      <!-- ====================================================
           Error
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

      <!-- ====================================================
           Loading
           ==================================================== -->

      <div
        v-if="
          loading
        "
        class="empty-state"
      >
        載入學生中...
      </div>

      <!-- ====================================================
           Students
           ==================================================== -->

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
          :key="
            student.id
          "
          :to="
            `/teacher/students/${student.id}`
          "
          class="student-card"
        >
          <!-- Student -->

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
                {{
                  student.name
                }}
              </h2>
            </div>

            <span class="arrow">
              ›
            </span>
          </header>

          <!-- No Package -->

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

          <!-- Packages -->

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
                    packageData.course_name
                  }}
                </strong>

                <span>
                  {{
                    packageData.purchased_cycles
                  }}
                  期
                  ・
                  $
                  {{
                    formatMoney(
                      packageData.price
                    )
                  }}
                </span>
              </div>

              <div class="package-progress">
                <strong>
                  {{
                    packageData.used_sessions
                  }}
                  /
                  {{
                    packageData.total_sessions
                  }}
                </strong>

                <span>
                  剩
                  {{
                    packageData.remaining_sessions
                  }}
                  堂
                </span>
              </div>
            </article>
          </section>
        </NuxtLink>
      </section>

      <div
        v-else
        class="empty-state"
      >
        沒有符合條件的學生。
      </div>
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
   Packages
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