package com.secureclipboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSnippetRequest {
    
    @NotBlank(message = "Content cannot be blank")
    @Size(max = 20_000_000, message = "Content size exceeds maximum limit (20MB)")
    private String content;
    
    @Size(max = 2048, message = "Source URL exceeds maximum length")
    private String sourceUrl;
}


