package com.example.gatekeeper.controller;

import com.example.gatekeeper.model.AnalysisHistory;
import com.example.gatekeeper.repository.HistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/netshield")
@CrossOrigin(origins = "*") 
public class TrafficController {

    @Autowired
    private HistoryRepository historyRepo;

    @PostMapping("/analyze/{dataset}/{type}")
    public ResponseEntity<?> processTraffic(@PathVariable String dataset, 
                                          @PathVariable String type,
                                          @RequestParam("file") MultipartFile file) {
        try {
            // Forward file to FastAPI (Python)
            RestTemplate restTemplate = new RestTemplate();
            String url = "http://localhost:8000/analyze/" + dataset + "/" + type;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", file.getResource());

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);

            // Save result to H2 Database (Section 3.6 of your PRD)
            AnalysisHistory history = new AnalysisHistory();
            history.setFilename(file.getOriginalFilename());
            history.setResult((String) response.getBody().get("prediction"));
            history.setConfidence((Double) response.getBody().get("confidence_score"));
            history.setTimestamp(LocalDateTime.now());
            historyRepo.save(history);

            return response;
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }
}