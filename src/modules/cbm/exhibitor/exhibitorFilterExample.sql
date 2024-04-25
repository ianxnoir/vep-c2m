SELECT * FROM vepExhibitorDb.vepExhibitor exhibitor    
LEFT JOIN (      
	SELECT pavilion.companyCcdId AS pavilionCcdId, pavilion.eoaFairId as pavilionEoaFairId, GROUP_CONCAT(DISTINCT pavilion.value) as pavilion      
	FROM vepExhibitorDb.vepExhibitorAttributes pavilion      
	WHERE pavilion.attribute = 'pavilion' AND pavilion.locale = 'en' AND pavilion.eoaFairId IN ('1949','1951')      
	GROUP BY pavilionCcdId, pavilionEoaFairId          
) pavilion ON exhibitor.companyCcdId = pavilionCcdId AND exhibitor.eoaFairId = pavilionEoaFairId  

LEFT JOIN (     
	SELECT zone.companyCcdId AS zoneCcdId, zone.eoaFairId as zoneEoaFairId, GROUP_CONCAT(DISTINCT zone.value) as zone      
	FROM vepExhibitorDb.vepExhibitorAttributes zone      
	WHERE zone.attribute = 'productZone' AND zone.locale = 'en' AND zone.eoaFairId IN ('1949','1951')      
	GROUP BY zoneCcdId, zoneEoaFairId          
) zone ON exhibitor.companyCcdId = zoneCcdId AND exhibitor.eoaFairId = zoneEoaFairId   

INNER JOIN (      
	SELECT pmaCode, pmq.companyCcdId AS pmqCcdId, pmq.eoaFairId as pmqEoaFairId, GROUP_CONCAT(DISTINCT pmaCode) as preferredMarket      
	FROM vepExhibitorDb.vepExhibitorC2mQuestions pmq      
	INNER JOIN (        
		SELECT pma.vepExhibitorQuestionId AS pmaQid, pma.code AS pmaCode       
		FROM vepExhibitorDb.vepExhibitorC2mAnswers pma
    ) pma ON pmq.id = pmaQid      
	WHERE pmq.locale = 'en' AND pmq.type = 'targetMarkets' AND pmq.eoaFairId IN ('1949','1951')      
	GROUP BY pmqCcdId, pmqEoaFairId      
	HAVING SUM( pmaCode IN ('JP')) > 0   
) pmq ON exhibitor.companyCcdId = pmqCcdId AND exhibitor.eoaFairId = pmqEoaFairId   

LEFT JOIN (      
	SELECT npmaCode, npmq.companyCcdId AS npmqCcdId, npmq.eoaFairId AS npmqEoaFairId, GROUP_CONCAT(DISTINCT npmaCode) as notPreferredMarket      
	FROM vepExhibitorDb.vepExhibitorC2mQuestions npmq     
	INNER JOIN (        
		SELECT npma.vepExhibitorQuestionId AS npmaQid, npma.code AS npmaCode        
		FROM vepExhibitorDb.vepExhibitorC2mAnswers npma 
    ) npma ON npmq.id = npmaQid      
	WHERE npmq.locale = 'en' AND npmq.type = 'nonTargetMarkets' AND npmq.eoaFairId IN ('1949','1951')      
	GROUP BY npmqCcdId, npmqEoaFairId          
) npmq ON exhibitor.companyCcdId = npmqCcdId AND exhibitor.eoaFairId = npmqEoaFairId    

LEFT JOIN (      
	SELECT pnaCode, pnq.companyCcdId AS pnqCcdId, pnq.eoaFairId AS pnqEoaFairId, GROUP_CONCAT(DISTINCT pnaCode) as preferredNob      
	FROM vepExhibitorDb.vepExhibitorC2mQuestions pnq
	INNER JOIN (        
		SELECT pna.vepExhibitorQuestionId AS pnaQid, pna.code AS pnaCode        
		FROM vepExhibitorDb.vepExhibitorC2mAnswers pna
    ) pna ON pnq.id = pnaQid      
	WHERE pnq.locale = 'en' AND pnq.type = 'nob' AND pnq.eoaFairId IN ('1949','1951')      
	GROUP BY pnqCcdId, pnqEoaFairId          
) pnq ON exhibitor.companyCcdId = pnqCcdId AND exhibitor.eoaFairId = pnqEoaFairId   
 
LEFT JOIN (      
	SELECT product.companyCcdId AS productCcdId, product.eoaFairId as productEoaFairId, GROUP_CONCAT(DISTINCT product.value) as productRange      
	FROM vepExhibitorDb.vepExhibitorAttributes product      
	WHERE product.attribute = 'productOrServiceRanges' AND product.locale = 'en' AND product.eoaFairId IN ('1949','1951')     
	GROUP BY productCcdId, productEoaFairId    
) product ON exhibitor.companyCcdId = productCcdId AND exhibitor.eoaFairId = productEoaFairId    
 
LEFT JOIN (      
	SELECT nob.companyCcdId AS nobCcdId, nob.eoaFairId as nobEoaFairId, GROUP_CONCAT(DISTINCT nob.code) as nobRange      
	FROM vepExhibitorDb.vepExhibitorAttributes nob      
	WHERE nob.attribute = 'nob' AND nob.locale = 'en' AND nob.eoaFairId IN ('1949','1951')      
	GROUP BY nobCcdId, nobEoaFairId   
) nob ON exhibitor.companyCcdId = nobCcdId AND exhibitor.eoaFairId = nobEoaFairId     
WHERE exhibitor.eoaFairId IN ('1949','1951')    
GROUP BY exhibitor.companyCcdId, exhibitor.eoaFairId