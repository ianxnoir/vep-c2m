-- for reference
-- SHOW PROCEDURE STATUS;

delimiter //
USE vepExhibitorDb;
DROP PROCEDURE IF EXISTS exhibitorMarketPreferenceView;
CREATE PROCEDURE exhibitorMarketPreferenceView()
BEGIN
-- 1) Drop table 
DROP TABLE IF EXISTS vepExhibitorDb.`exhibitorMarketPreference_view`;

-- 2) Create table
CREATE TABLE vepExhibitorDb.`exhibitorMarketPreference_view` (
	SELECT
		eQue.id AS eQueId,
		eQue.companyCcdId AS eQueCcdId,
		eQue.eoaFairId AS eQueEoaFairId,
		GROUP_CONCAT(CASE WHEN eQue.type = 'currentExportMarkets' THEN eAnsAnswer END) AS eCurrentExportMarkets,
		GROUP_CONCAT(CASE WHEN eQue.type = 'currentExportMarkets' THEN eAnsCodes END) AS eCurrentExportCodes,
		GROUP_CONCAT(CASE WHEN eQue.type = 'targetMarkets' THEN eAnsAnswer END) AS eTargetMarkets,
		GROUP_CONCAT(CASE WHEN eQue.type = 'targetMarkets' THEN eAnsCodes END) AS eTargetCodes,
		GROUP_CONCAT(CASE WHEN eQue.type = 'nonTargetMarkets' THEN eAnsAnswer END) AS eAvoidMarkets,
		GROUP_CONCAT(CASE WHEN eQue.type = 'nonTargetMarkets' THEN eAnsCodes END) AS eAvoidCodes,
		GROUP_CONCAT(CASE WHEN eQue.type = 'preferredNOB' THEN eAnsAnswer END) AS eNob,
		GROUP_CONCAT(CASE WHEN eQue.type = 'preferredNOB' THEN eAnsCodes END) AS eNobCodes
	FROM vepExhibitorDb.vepExhibitorC2mQuestions AS eQue
	INNER JOIN (
		SELECT
			eAns.id AS cAnsId,
			eAns.vepExhibitorQuestionId AS eAnsQuestId,
			eAns.answer AS eAns,
			eAns.code AS eAnsCode,
			GROUP_CONCAT(DISTINCT eAns.answer ORDER BY eAns.code ) AS eAnsAnswer,
			GROUP_CONCAT(DISTINCT eAns.code ORDER BY eAns.code ) AS eAnsCodes
		FROM vepExhibitorDb.vepExhibitorC2mAnswers AS eAns
		GROUP BY eAnsQuestId
	) eAns ON eAns.eAnsQuestId = eQue.id
	WHERE 
		eQue.locale = 'en'
		AND (eQue.type = 'currentExportMarkets' OR eQue.type = 'nonTargetMarkets' OR eQue.type = 'targetMarkets' OR eQue.type = 'preferredNOB')
	GROUP BY eQue.companyCcdId, eQue.eoaFairId
);

-- 3) Create index
CREATE UNIQUE INDEX eQueId ON vepExhibitorDb.`exhibitorMarketPreference_view`(eQueId);
CREATE INDEX eQueCcdId_eQueEoaFairId ON vepExhibitorDb.`exhibitorMarketPreference_view`(eQueCcdId,eQueEoaFairId);
END //

delimiter ;

-- for reference
-- call exhibitorMarketPreferenceView();