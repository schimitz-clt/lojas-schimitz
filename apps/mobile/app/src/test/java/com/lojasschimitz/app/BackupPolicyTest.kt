package com.lojasschimitz.app

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Cookies de sessão do WebView não podem sair do aparelho por backup / transferência. */
class BackupPolicyTest {
    private fun main(p: String) = File("src/main/$p").readText()

    @Test
    fun manifestDisablesBackupAndPointsToRules() {
        val m = main("AndroidManifest.xml")
        assertTrue(m.contains("android:allowBackup=\"false\""))
        assertFalse(m.contains("android:allowBackup=\"true\""))
        assertTrue(m.contains("android:dataExtractionRules=\"@xml/data_extraction_rules\""))
        assertTrue(m.contains("android:fullBackupContent=\"@xml/backup_rules\""))
    }

    @Test
    fun extractionRulesExcludeEverythingInCloudAndDeviceTransfer() {
        val x = main("res/xml/data_extraction_rules.xml")
        for (section in listOf("cloud-backup", "device-transfer")) {
            val body = x.substringAfter("<$section>").substringBefore("</$section>")
            for (d in listOf("root", "file", "database", "sharedpref", "device_root", "device_sharedpref")) {
                assertTrue("$section exclui $d", body.contains("<exclude domain=\"$d\" path=\".\" />"))
            }
            assertFalse("$section sem include", body.contains("<include"))
        }
    }
}
