# ************************************************************
# Sequel Pro SQL dump
# Version 5446
#
# https://www.sequelpro.com/
# https://github.com/sequelpro/sequelpro
#
# Host: 127.0.0.1 (MySQL 5.7.26)
# Database: vep_c2m_service_db
# Generation Time: 2021-11-04 08:54:41 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
SET NAMES utf8mb4;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Dump of table vepC2MHiddenRecord
# ------------------------------------------------------------

CREATE TABLE `vepC2MHiddenRecord` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `ssoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fairYear` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hiddenType` int(11) DEFAULT NULL,
  `hiddenTarget` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creationTime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



# Dump of table vepC2MMeeting
# ------------------------------------------------------------

CREATE TABLE `vepC2MMeeting` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fiscalYear` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `type` tinyint(4) DEFAULT NULL,
  `f2fLocation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignerId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignerRole` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterSsoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterResponseStatus` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterEmailStatus` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterFirstName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterLastName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterRole` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterCompanyName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterSupplierUrn` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterExhibitorUrn` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterCountryCode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterCompanyLogo` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderSsoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderFirstName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderLastName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderRole` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderCompanyName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderSupplierUrn` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderExhibitorUrn` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderCountryCode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderCompanyLogo` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderResponseStatus` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderEmailStatus` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderFairCode` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderFiscalYear` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scoreToBuyer` tinyint(1) unsigned DEFAULT NULL,
  `scoreToBuyerRefTxt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scoreToExhibitor` tinyint(1) unsigned DEFAULT NULL,
  `scoreToExhibitorRefTxt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint(3) unsigned DEFAULT '0',
  `rescheduledTo` int(10) unsigned DEFAULT NULL,
  `rescheduledTime` int(10) unsigned DEFAULT '0',
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `zoomId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zoomStartUrl` text COLLATE utf8mb4_unicode_ci,
  `zoomJoinUrl` text COLLATE utf8mb4_unicode_ci,
  `isRequesterJoined` tinyint(3) unsigned DEFAULT '0',
  `isResponderJoined` tinyint(3) unsigned DEFAULT '0',
  `cancelledBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelledByRole` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelledReason` text COLLATE utf8mb4_unicode_ci,
  `isExtended` tinyint DEFAULT '0',
  `isRefusedExtend` tinyint DEFAULT '0',
  `createdBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creationTime` datetime DEFAULT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastUpdatedAt` datetime DEFAULT NULL,
  `deletionTime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



# Dump of table vepC2MBMRecommendation
# ------------------------------------------------------------

CREATE TABLE `vepC2MBMRecommendation` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `ssoUid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sentTime` datetime NOT NULL,
  `readStatus` int(11) NOT NULL DEFAULT 0,
  `emailStatus` int(11) NOT NULL DEFAULT 0,
  `notificationStatus` int(11) NOT NULL DEFAULT 0,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fairYear` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publishType` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "internal",
  `bmMessage` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creationTime` datetime NOT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  `deletionTime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


# Dump of table vepC2MBMRecommendationItem
# ------------------------------------------------------------

CREAT TABLE `vepC2MBMRecommendationItem` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `recommendationId` int(11) NOT NULL,
  `targetId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fiscalYear` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `interestedStatus` int(11) NOT NULL DEFAULT 0 ,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creationTime` datetime NOT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


# Dump of table vepC2MMeetingConfig
# ------------------------------------------------------------

CREATE TABLE `vepC2MMeetingConfig` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fairYear` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feedbackFormId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creationTime` datetime NOT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  `deletionTime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


# Dump of table vepC2MUnavailableTimeslot
# ------------------------------------------------------------

CREATE TABLE `vepC2MUnavailableTimeslot` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fairCode` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fiscalYear` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ssoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `createdBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creationTime` datetime DEFAULT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastUpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



# Dump of table vepC2MUserMeta
# ------------------------------------------------------------

CREATE TABLE `vepC2MUserMeta` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `ssoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `creationTime` datetime DEFAULT NULL,
  `lastUpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



# Dump of table vepC2MVideoConference
# ------------------------------------------------------------

CREATE TABLE `vepC2MVideoConference` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `connectionId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ssoUid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `displayCompany` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `companyRole` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isAdmitted` tinyint(4) DEFAULT 0,
  `joinedAt` datetime DEFAULT NULL,
  `disconnectedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# Dump of table vepC2MSqsRecord
# ------------------------------------------------------------
CREATE TABLE `vepC2MSqsRecord` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `meetingId` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `templateStatus` int(10) unsigned DEFAULT NULL,
  `dynamicVariableStatus` int(10) unsigned DEFAULT NULL,
  `responderEmailStatus` int(10) unsigned DEFAULT 0,
  `responderNotiStatus` int(10) unsigned DEFAULT 0,
  `requesterEmailStatus` int(10) unsigned DEFAULT 0,
  `requesterNotiStatus` int(10) unsigned DEFAULT 0,
  `responderContent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterContent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderEmailRemark` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterEmailRemark` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responderNotiRemark` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requesterNotiRemark` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 60 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# Dump of table vepC2MHiddenRecord
# ------------------------------------------------------------

CREATE TABLE `vepC2MLog` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `section` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `step` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creationTime` datetime DEFAULT NULL,
  `lastUpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vepZOOMLicense` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountEmail` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creationTime` datetime NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SELECT
  *
FROM
  vep_c2m_service_db.vepC2MMeeting;

CREATE TABLE `vepC2MNotification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  `templateId` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channelType` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notificationType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receiverRole` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notificationContent` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sqsResponse` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint(2) NOT NULL DEFAULT 0,
  `retryCount` tinyint(2) NOT NULL DEFAULT 0,
  `creationTime` datetime NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vepSendbirdLicense` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `meetingId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `referenceKey` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyInt(1) NOT NULL DEFAULT 0,
  `creationTime` datetime NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

CREATE TABLE `vepC2MConfig` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fieldName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `configValue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdatedBy` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastUpdatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
